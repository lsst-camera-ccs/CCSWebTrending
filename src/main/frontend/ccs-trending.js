import './node_modules/@tonyj321/shibui-dropdown-menu/shibui-dropdown-menu.js';
import './node_modules/@polymer/iron-icons/iron-icons.js';
import Dygraph from './node_modules/@tonyj321/dygraphs/index.js';
import { html, css, LitElement } from './node_modules/lit-element/lit-element.js';

class RangeSynchronizer {
    constructor() {
        this.plots = [];
        this._range = 24 * 60 * 60 * 1000;
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
}

const _rangeSynchronizer = new RangeSynchronizer();

class TrendingPlot extends LitElement {

    static get styles() {
        return css`
            :host {
                background: orange;
                display: flex;
                flex-direction: column;
                width: 100%;
            }
            .graph {
                background: red;
                width: 100% !important;
            }
            .legend {
                width: 100%;
                font-size: 14px;
            }
            .menu-bar {
                background: green;
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
            <div class="graph"></div>
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
                type: Object,
                notify: true,
                reflect: true
            },

            useUTC: {
                type: Boolean,
                notify: true,
                reflect: true,
            },

            restURL: {
                type: String
            }
        };
    }

    constructor() {
        super();
        this.errorbars = 'NONE';
        this.logscale = false;
        this.labels = ['time'];
        this.restURL = 'rest';
        this.useUTC = false;
        this.nBins = 100;
        this.keys = [];
        this.range = 24 * 60 * 60 * 1000;
        this.autoUpdate = true;
        _rangeSynchronizer.add(this);
        this.synchronizer = _rangeSynchronizer;
        this.series = {};

        document.addEventListener("DOMContentLoaded", () => {
            let data = this.querySelectorAll('trending-data');
            data.forEach((node) => {
                this.keys.push(node.key);
                this.labels.push(node.label);
                if (node.axis === "y2") {
                    this.series[node.label] = {"axis": "y2"};
                }
            });
            this._updateData();
        });
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
                this.range = {start: Math.round(minDate), end: Math.round(maxDate)};
            },
            zoomCallback: (minDate, maxDate, yRanges) => {
                this.range = {start: Math.round(minDate), end: Math.round(maxDate)};
            }
        });
        if (this.autoUpdate) {
            this.timer = setInterval(() => {
                if (!isNaN(this.range))
                    this._reloadData();
            }, 60000);
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this.auoUpdate) {
            clearTimeout(this.timer);
        }
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
        if (isNaN(range)) {
            return range;
        } else {
            var now = Date.now();
            var then = now - range;
            return {start: then, end: now};
        }
    };
    
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
                } else {
                    alert(`error ( ${this.restURL} ${args} returned ${request.status}`);
                }
            };
            request.onerror = () => {
                alert(`error ( ${this.restURL} ${args} returned ${request.status}`);
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
                return `<div class="legendElement" style="display: inline; color: ${series.color};">
                        <input id="${i}" style="vertical-align: middle;" type="checkbox" ${series.isVisible ? "checked" : ""} 
                               onclick="this.closest('.legend').toggleVisibility(this.id)">${series.dashHTML} ${series.labelHTML}</div>`;
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
            html += `<div style="display: inline; color: ${series.color};">${series.dashHTML} ${labeledData}</div>&nbsp;`;
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
            var link = document.createElement("a");
            if (link.download !== undefined) { // feature detection
                // Browsers that support HTML5 download attribute
                var url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", filename);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        }
    }
    ;
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

    get label() {
        return this.innerHTML;
    }
};


class TrendingController extends LitElement {

    static get styles() {
        return css`
           @host .link-interaction a:visited { color: blue; }
        `;
    }

    render() {
        return html`
            <div class="link-interaction">
                <b>Zoom:</b>
                <a href="#" @click=${() => this._zoom(60)} id="hour">hour</a> 
                <a href="#" @click=${() => this._zoom(3 * 60)} id="3hour">3 hour</a> 
                <a href="#" @click=${() => this._zoom(6 * 60)} id="6hour">6 hour</a> 
                <a href="#" @click=${() => this._zoom(12 * 60)} id="12hour">12 hour</a> 
                <a href="#" @click=${() => this._zoom(24 * 60)} id="day">day</a> 
                <a href="#" @click=${() => this._zoom(7 * 24 * 60)} id="week">week</a> 
                <a href="#" @click=${() => this._zoom(31 * 24 * 60)} id="month">month</a>.
                Or drag to select area for zoom, or shift drag to pan.<br>
                <b>Error Bars:</b> 
                <a href="#" @click=${() => this._setErrorBars('NONE')} id="none">none</a> 
                <a href="#" @click=${() => this._setErrorBars('MINMAX')} id="minmax">min/max</a> 
                <a href="#" @click=${() => this._setErrorBars('RMS')} id="rms">rms</a> 
            </div>
        `;
    }

    _zoom(minutes) {
        _rangeSynchronizer.range = minutes * 60 * 1000;
    }

    _setErrorBars(type) {
        document.querySelectorAll("trending-plot").forEach(function (plot) {
            plot.errorbars = type;
        });
    }
}
;

customElements.define('trending-plot', TrendingPlot);
customElements.define('trending-data', TrendingData);
customElements.define('trending-controller', TrendingController);