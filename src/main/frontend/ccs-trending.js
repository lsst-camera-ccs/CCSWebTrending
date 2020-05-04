import '@tonyj321/shibui-dropdown-menu/shibui-dropdown-menu.js';
import '@polymer/iron-icons';
import Dygraph from '@tonyj321/dygraphs';
import { ResizeObserver } from '@juggle/resize-observer';
import { html, css, LitElement } from 'lit-element';
var parse = require('parse-duration');

class RangeSynchronizer {
    constructor() {
        this.plots = [];
        this._range = '1d';
        this._errorbars = 'MINMAX';
        this._useUTC = false;
    }

    add(plot) {
        this.plots.push(plot);
    }

    remove(plot) {
        this.plots.remove(plot);
    }

    set range(value) {
        this._range = value;
        this.plots.forEach((plot) => plot.range = value);
    }

    get range() {
        return this._range;
    }

    set errorbars(value) {
        this._errorbars = value;
        this.plots.forEach((plot) => plot.errorbars = value);
    }

    get errorbars() {
        return this._errorbars;
    }

    set useUTC(value) {
        this._useUTC = value;
        this.plots.forEach((plot) => plot.useUTC = value);
    }

    get useUTC() {
        return this._useUTC;
    }
}

const _rangeSynchronizer = new RangeSynchronizer();

class TrendingPlot extends LitElement {

    static get styles() {
        return css`
            :host {
                display: grid;
                grid-template-rows: auto auto 1fr;
                grid-template-columns: 100%;
                width: 100%;
            }
            .graph {
                grid-row: 3;
                grid-column: 1;
                width: 100% !important;
            }
            .legend {
                width: 100%;
                font-size: 14px;
            }
            .message {
                pointer-events: none;
                text-align: center;
                grid-row: 3;
                grid-column: 1;
                z-index: 50;
                width: 100%;
                font-size: 14px;
            }
            .legend .legendElement {
                display: inline;
            }
            .legend .legendElement input {
                vertical-align: middle; 
                display: none;
            }
            .legend:hover .legendElement input {
                display: inline;
            }         
            .menu-bar {
                width: 100%;
                display: flex;
                flex-direction: row;
                flex-wrap: wrap;
            }
            .menu-bar .title {
                font-weight: bold;
                z-index: 10;
                text-align: center;
                font-size: 20px;
                flex: 1;
            }
            .menu-bar shibui-dropdown-menu {
                flex: 0;
            }
        `;
    }

    render() {

        return html`
           <link rel="stylesheet" href="//cdnjs.cloudflare.com/ajax/libs/dygraph/2.1.0/dygraph.css" />
           <div class="menu-bar"><div class="title">${this.title}</div>       
                <shibui-dropdown-menu alignment="right">
                    <iron-icon slot="trigger" icon="menu"></iron-icon>
                    <label for="useUTC"><input @click=${() => this.useUTC = !this.useUTC} type="checkbox" id="useUTC" ?checked=${this.useUTC}>Use UTC</label>
                    <label for="logscale"><input @click=${() => this.logscale = !this.logscale} type="checkbox" id="logscale" ?checked=${this.logscale}>Log scale</label>
                    <a @click=${this.download}>Download data as .csv</a>                       
                </shibui-dropdown-menu>
            </div>
            <div class="legend">Legend</div>   
            <div class="graph" title="Drag to select range for zoom, or shift drag to pan."></div>
            <div class="message">${this._message}</div>   
        `;
    }
    static get properties() {
        return {
            title: {
                type: String,
                notify: true
            },

            ylabel: {
                type: String,
                notify: true
            },

            y2label: {
                type: String,
                notify: true
            },

            logscale: {
                type: Boolean,
                notify: true,
                reflect: true
            },

            errorbars: {
                type: String,
                notify: true,
                reflect: true
            },

            range: {
                type: String,
                notify: true,
                reflect: true
            },

            useUTC: {
                type: Boolean,
                notify: true,
                reflect: true
            },

            restURL: {
                type: String
            }
        };
    }

    constructor() {
        super();
        _rangeSynchronizer.add(this);
        this.errorbars = _rangeSynchronizer.errorbars;
        this.useUTC = _rangeSynchronizer.useUTC;
        this.range = _rangeSynchronizer.range;
        this.logscale = false;
        this.labels = ['time'];
        this.restURL = 'rest';
        this.nBins = 100;
        this.keys = [];
        this.autoUpdate = true;
        this.synchronizer = _rangeSynchronizer;
        this.series = {};
        this._message = "";
    }

    firstUpdated(changedProperties) {
        this.shadowRoot.querySelector(".legend").toggleVisibility = (series) => {
            this._toggleVisibility(series);
        };

        let dummyData = [Array.apply(null, Array(this.labels.length)).map(Number.prototype.valueOf, 0), Array.apply(null, Array(this.labels.length)).map(Number.prototype.valueOf, 0)];
        let timeRange = this._toTimeRange(this.range);
        dummyData[0][0] = new Date(timeRange.start);
        dummyData[1][0] = new Date(timeRange.end);
        this.graph = new Dygraph(this.shadowRoot.querySelector('.graph'), dummyData, {
            labels: this.labels,
            legend: 'always',
            series: this.series,
            ylabel: this.ylabel,
            y2label: this.y2label,
            labelsDiv: this.shadowRoot.querySelector('.legend'),
            animatedZooms: true,
            labelsUTC: this.useUTC,
            logscale: this.logscale,
            connectSeparatedPoints: true,
            drawPoints: true,
            legendFormatter: this._legendFormatter,
            endPanCallback: (minDate, maxDate, yRanges) => {
                this.range = JSON.stringify({start: Math.round(minDate), end: Math.round(maxDate)});
            },
            zoomCallback: (minDate, maxDate, yRanges) => {
                this.range = JSON.stringify({start: Math.round(minDate), end: Math.round(maxDate)});
            }
        });
        this._ro = new ResizeObserver((entries, observer) => {
           this.graph.resize();
        });
        this._ro.observe(this);
        
        if (this.autoUpdate) {
            this.timer = setInterval(() => {
                if (!this.range.startsWith('{'))
                    this._reloadData();
            }, 60000);
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this.auoUpdate) {
            clearTimeout(this.timer);
        }
        this._ro.disconnect();
    }
    
    set _message(value) {
        this.__message = value;
        this.requestUpdate();
    }

    get _message() {
        return this.__message;
    }

    set range(value) {
        if (value !== this.range) {
            const oldValue = this.range;
            this._range = value;
            this.requestUpdate('range', oldValue);
            if (this.synchronizer) {
                this.synchronizer.range = value;
            }
        }
    }

    get range() {
        return this._range;
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        changedProperties.forEach((oldValue, name) => {
            if (name === 'range') {
                this._updateRange();
            } else if (name === 'errorbars') {
                this._updateErrorBars();
            } else if (name === 'useUTC') {
                this.graph.updateOptions({labelsUTC: this.useUTC});
            } else if (name === 'logscale') {
                this.graph.updateOptions({logscale: this.logscale});
            }
        });
    }

    // Called when autoupdate wants to update the data.
    _reloadData() {
        this._updateRange();
    }

    _toTimeRange(range) {
        if (range.startsWith('{')) {
            return JSON.parse(range);
        } else {
            var now = Date.now();
            var then = now - (isNaN(range) ? parse(range) : range);
            return {start: then, end: now};
        }
    }
            _updateRange() {
        let timeRange = this._toTimeRange(this.range);
        this.graph.updateOptions({dateWindow: [timeRange.start, timeRange.end]});
        this._updateData();
    }

    _updateErrorBars() {
        this._updateData();
    }

    _toggleVisibility(series) {
        this.graph.setVisibility(series, !this.graph.visibility()[series]);
    }

    _updateData() {
        if (this.keys.length === 0)
            return;
        this._message = "Loading data...";
        let timeRange = this._toTimeRange(this.range);
        let args = this._parseUrlParams({"key": this.keys, "t1": timeRange.start, "t2": timeRange.end, "n": this.nBins, 'errorBars': this.errorbars}, true);
        if (typeof (this.graph) !== "undefined") {
            let request = new XMLHttpRequest();
            request.open('GET', this.restURL + '?' + args, true);
            request.onload = () => {
                if (request.status >= 200 && request.status < 400) {
                    // Success!
                    let newData = JSON.parse(request.responseText);
                    for (var i = 0; i < newData.data.length; i++) {
                        newData.data[i][0] = new Date(newData.data[i][0]);
                    }
                    let errorBarsType = newData.meta.errorBars;
                    let customBars = errorBarsType === 'MINMAX';
                    let errorBars = errorBarsType === 'RMS';
                    this.graph.updateOptions({file: newData.data, customBars: customBars, errorBars: errorBars, labels: this.labels});
                    this._message = "";
                } else {
                    this._message = `error ( ${this.restURL} ${args} returned ${request.status}`;
                }
            };
            request.onerror = () => {
                this._message = `error ( ${this.restURL} ${args} returned ${request.status}`;
            };
            request.send();
        }
    }

    _parseUrlParams(params, isArray = false, keys = []) {
        const p = Object.keys(params).map(key => {
            let val = params[key];

            if ("[object Object]" === Object.prototype.toString.call(val) || Array.isArray(val)) {
                if (Array.isArray(params)) {
                    keys.push("");
                } else {
                    keys.push(key);
                }
                return this._parseUrlParams(val, Array.isArray(val), keys);
            } else {
                let tKey = key;

                if (keys.length > 0) {
                    const tKeys = isArray ? keys : [...keys, key];
                    tKey = tKeys.reduce((str, k) => {
                        return "" === str ? k : `${str}[${k}]`;
                    }, "");
                }
                if (isArray) {
                    return `${tKey}=${val}`;
                } else {
                    return `${tKey}=${val}`;
                }

            }
        }).join('&');

        keys.pop();
        return p;
    }

    _legendFormatter(data) {
        if (typeof (data.x) === "undefined") {
            // This happens when there's no selection and {legend: 'always'} is set.
            return data.series.map(function (series, i) {
                return `<div class="legendElement" style="color: ${series.color};">
                        <label for="${i}">
                        <input id="${i}" type="checkbox" ${series.isVisible ? "checked" : ""} 
                               onclick="this.closest('.legend').toggleVisibility(this.id)">${series.dashHTML} ${series.labelHTML}</label></div>`;
            }).join('&nbsp;');
        }
        var html = data.xHTML + ":&nbsp;";
        data.series.forEach(function (series) {
            if (!series.isVisible || typeof (series.y) === "undefined")
                return;
            var labeledData = series.labelHTML + ': ' + series.yHTML;
            if (series.isHighlighted) {
                labeledData = '<b>' + labeledData + '</b>';
            }
            html += `<div class="legendElement" style="color: ${series.color};">${series.dashHTML} ${labeledData}</div>&nbsp;`;
        });
        return html;
    }

    download() {
        let filename = this.title + '.tsv';
        let CSVContent = "";
        //create header
        for (let i = 0; i < this.labels.length; i++) {
            if (i === 0)
                CSVContent = CSVContent + this.labels[i];
            else
                CSVContent = CSVContent + '\t' + this.labels[i];
        }

        //get data
        for (let i = 0; i < this.graph.rawData_.length; i++) {
            CSVContent = CSVContent + '\r' + '\n';
            for (var j = 0; j < this.graph.rawData_[i].length; j++) {
                if (j === 0)
                    CSVContent = CSVContent + ((this.graph.rawData_[i][j] / 86400000) + 25569);
                else
                    CSVContent = CSVContent + '\t' + this.graph.rawData_[i][j];
            }
        }

        //send TSV content to download
        let blob = new Blob([CSVContent], {type: 'text/csv;charset=utf-8;'});
        if (navigator.msSaveBlob) { // IE 10+
            navigator.msSaveBlob(blob, filename);
        } else {
            let link = document.createElement("a");
            if (link.download !== undefined) { // feature detection
                // Browsers that support HTML5 download attribute
                let url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", filename);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        }
    }
}

class TrendingData extends LitElement {

    static get properties() {
        return {
            axis: {
                type: String
            },

            key: {
                type: Number
            }
        };
    }
    
    connectedCallback() {
        super.connectedCallback();
        this._plot = this.closest("trending-plot");
        this._plot.keys.push(this.key);
        this._plot.labels.push(this.label);
        if (this.axis === "y2") {
            this._plot.series[this.label] = {"axis": "y2"};
        }
    }
    
    disconnectedCallback() {
        super.disconnectedCallback();
        const index = this._plot.keys.indexOf(this.key);
        if (index > -1) {
           this._plot.keys.splice(index, 1);
        }
        const index2 = this._plot.labels.indexOf(this.label);
        if (index2 > -1) {
           this._plot.labels.splice(index2, 1);
        }
        if (this.axis === "y2") {
            this._plot.series[this.label] = {};
        }
    }   
    
    get label() {
        return this.innerHTML;
    }
};


class TrendingController extends LitElement {

    static get properties() {
        return {
            errorbars: {
                type: String,
                notify: true,
                reflect: true
            },

            range: {
                type: String,
                notify: true,
                reflect: true
            },

            useUTC: {
                type: Boolean,
                notify: true,
                reflect: true
            }
        };
    }

    render() {
        return html`
            <div class="link-interaction">
                <b>Range:</b>
                <select id="rangeSelector" @change=${this._zoom}>
                    <option value="1h"     ?selected=${this._quantizedRange === '1h'}>Hour</option>
                    <option value="3h"     ?selected=${this._quantizedRange === '3h'}>3 Hour</option>
                    <option value="6h"     ?selected=${this._quantizedRange === '6h'}>6 hour</option>
                    <option value="12h"    ?selected=${this._quantizedRange === '12h'}>12 Hour</option>
                    <option value="1d"     ?selected=${this._quantizedRange === '1d'}>Day</option>
                    <option value="1w"     ?selected=${this._quantizedRange === '1w'}>Week</option>
                    <option value="1month" ?selected=${this._quantizedRange === '1month'}>Month</option>
                    <option disabled       ?selected=${this._quantizedRange === 'custom'}>Custom</option>
                </select>
                <b>Error Bars:</b> 
                <select id="errorBarSelector" @change=${this._setErrorBars}>
                    <option value="NONE"   ?selected=${this.errorbars === 'NONE'}>None</option>
                    <option value="MINMAX" ?selected=${this.errorbars === 'MINMAX'}>MinMax</option>
                    <option value="RMS"    ?selected=${this.errorbars === 'RMS'}>RMS</option>
                </select>
                <b>Timezone:</b> 
                <select id="timeZoneSelector" @change=${this._setTimeZone}>
                    <option value="false" ?selected=${!this.useUTC}>Local (${Intl.DateTimeFormat().resolvedOptions().timeZone})</option>
                    <option value="true"  ?selected=${this.useUTC}>UTC</option>
                </select>
            </div>
        `;
    }

    constructor() {
       super();
       _rangeSynchronizer.add(this);
       this.range = _rangeSynchronizer.range;
       this.useUTC = _rangeSynchronizer.useUTC;
       this.errorbars = _rangeSynchronizer.errorbars;
    }
    
    firstUpdated(changedProperties) {
       _rangeSynchronizer.range = this.range;
       _rangeSynchronizer.useUTC = this.useUTC;
       _rangeSynchronizer.errorbars = this.errorbars ;  
    };
    
    set range(value) {
        const oldValue = this.range;
        this._range = value;
        this._quantizedRange = this._computeQuantizedRange();
        this.requestUpdate('range', oldValue);
    }

    get range() {
        return this._range;
    }
    
    _zoom() {
        _rangeSynchronizer.range = this.shadowRoot.querySelector("#rangeSelector").value;
    }

    _setErrorBars() {
        _rangeSynchronizer.errorbars = this.shadowRoot.querySelector("#errorBarSelector").value;
    }

    _setTimeZone() {
        _rangeSynchronizer.useUTC = this.shadowRoot.querySelector("#timeZoneSelector").value === 'true';
    }
    
    _computeQuantizedRange() {
        try {
            let rangeInMinutes = Math.round(parse(this.range)/1000/60);
            switch (rangeInMinutes) {
                case 60:  return '1h';
                case 60*3: return '3h';
                case 60*6: return '6h';
                case 60*12: return '12h';
                case 60*24: return '1d';
                case 60*24*7: return '1w';
                case 60*24*7*30: return '1month';
                default: return 'custom';
            }
        } catch (typeerror) {
            return 'custom';
        }
    }
};

customElements.define('trending-plot', TrendingPlot);
customElements.define('trending-data', TrendingData);
customElements.define('trending-controller', TrendingController);