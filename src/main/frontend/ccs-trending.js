import '@tonyj321/shibui-dropdown-menu/shibui-dropdown-menu.js';
import '@polymer/iron-icons';
import '@fooloomanzoo/datetime-picker/datetime-picker.js';
import Dygraph from '@tonyj321/dygraphs';
import { ResizeObserver } from '@juggle/resize-observer';
import { html, css, LitElement } from 'lit-element';
let parse = require('parse-duration');

class RangeSynchronizer {
    constructor() {
        this.plots = [];
        this._range = '1d';
        this._errorbars = 'MINMAX';
        this._useUTC = false;
        this._nBins = 100;
        this._source = 'Some Default';
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

    set source(value) {
        this._source = value;
        this.plots.forEach((plot) => plot.source = value);
    }

    get source() {
        return this._source;
    }

    set useUTC(value) {
        this._useUTC = value;
        this.plots.forEach((plot) => plot.useUTC = value);
    }

    get useUTC() {
        return this._useUTC;
    }

    set nBins(value) {
        this._nBins = value;
        this.plots.forEach((plot) => plot.nBins = value);
    }

    get nBins() {
        return this._nBins;
    }
}

const _defaultRangeSynchronizer = new RangeSynchronizer();
const _rangeSynchronizerGroups = {"defaultGroup": _defaultRangeSynchronizer};

function _rangeSynchronizerForGroup(group) {
    let result = _rangeSynchronizerGroups[group];
    if (!result) {
        result = new RangeSynchronizer();
        _rangeSynchronizerGroups[group] = result;
    }
    return result;
}

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

            source: {
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
            },

            group: {
                type: String
            },
            
            nBins: {
                type: Number,
                notify: true,
                reflect: true
            }
        };
    }

    constructor() {
        super();
        this.group = "defaultGroup";
        this.errorbars = _defaultRangeSynchronizer.errorbars;
        this.useUTC = _defaultRangeSynchronizer.useUTC;
        this.range = _defaultRangeSynchronizer.range;
        this.source = _defaultRangeSynchronizer.source;
        this.logscale = false;
        this.labels = ['time'];
        this.restURL = 'rest';
        this.nBins = 100;
        this.keys = [];
        this.autoUpdate = true;
        this.series = {};
        this._message = "";
    }

    firstUpdated(changedProperties) {
        this.synchronizer = _rangeSynchronizerForGroup(this.group);
        this.synchronizer.add(this);
        if (!("errorbars" in changedProperties)) this.errorbars = this.synchronizer.errorbars;
        if (!("source" in changedProperties)) this.source = this.synchronizer.source;
        if (!("useUTC" in changedProperties)) this.useUTC = this.synchronizer.useUTC;
        if (!("range" in changedProperties)) this.range = this.synchronizer.range;
        if (!("nBins" in changedProperties)) this.nBins = this.synchronizer.nBins;

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
            axes: {
                y: { axisLabelWidth: 60 },
                y2: {axisLabelWidth: 60 }
            },
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
        let reloadNeeded = false;
        changedProperties.forEach((oldValue, name) => {
            if (name === 'range') {
                reloadNeeded = true;
            } else if (name === 'errorbars') {
                reloadNeeded = true;
            } else if (name === 'source') {
                reloadNeeded = true;
            } else if (name === 'nBins') {
                reloadNeeded = true;
            } else if (name === 'useUTC') {
                this.graph.updateOptions({labelsUTC: this.useUTC});
            } else if (name === 'logscale') {
                this.graph.updateOptions({logscale: this.logscale});
            }
        });

        if (reloadNeeded) {
            this.updateComplete.then(() => {
                this._updateData();
            });
        }
    }

    // Called when autoupdate wants to update the data.
    _reloadData() {
        this._updateData();
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

    _toggleVisibility(series) {
        this.graph.setVisibility(series, !this.graph.visibility()[series]);
    }

    _updateData() {
        if (this.keys.length === 0)
            return;
        if (document.visibilityState !== 'visible') {
            this._message = "Update suppressed ("+document.visibilityState+")";
            return;
        }
        this._message = "Loading data...";
        let timeRange = this._toTimeRange(this.range);
        this.graph.updateOptions({dateWindow: [timeRange.start, timeRange.end]});
        let args = this._parseUrlParams({"key": this.keys, "t1": timeRange.start, "t2": timeRange.end, "n": this.nBins, 'errorBars': this.errorbars, 'source': this.source}, true);
        if (typeof (this.graph) !== "undefined") {
            if (this._request) {
                this._request.abort();
            }
            let request = new XMLHttpRequest();
            this._request = request;
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
                    let options = {file: newData.data, customBars: customBars, errorBars: errorBars, labels: this.labels};
                    // Messy code to deal with units. Units are received with the data, and need to be associated
                    // with the corresponding axis, only if the user has not explicitly specified axes titles.
                    let axisUnits = {"y1": new Set(), "y2": new Set()};
                    newData.meta.perData.forEach((meta, i) => {
                        axisUnits[this.series[this.labels[i+1]].axis].add(meta.units);
                    });
                    if (axisUnits["y1"].size === 1 && !this.ylabel) {
                        options["ylabel"] = axisUnits["y1"].values().next().value;
                    } else {
                        options["ylabel"] = this.ylabel;
                    }
                    if (axisUnits["y2"].size === 1 && !this.y2label) {
                        options["y2label"] = axisUnits["y2"].values().next().value;
                    } else {
                        options["y2label"] = this.y2label;
                    }
                    this.graph.updateOptions(options);
                    this._message = "";
                } else {
                    this._message = `error ( ${this.restURL} ${args} returned ${request.status}`;
                }
                this._request = null;
            };
            request.onerror = () => {
                this._message = `error ( ${this.restURL} ${args} returned ${request.status}`;
                this._request = null;
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
    constructor() {
        super();
        this.axis = "y1";
    }

    connectedCallback() {
        super.connectedCallback();
        this._plot = this.closest("trending-plot");
        this._plot.keys.push(this.key);
        this._plot.labels.push(this.label);
        this._plot.series[this.label] = {"axis": this.axis};
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
    }

    get label() {
        return this.innerHTML;
    }
};


class TrendingController extends LitElement {
    
        static get styles() {
            return css`
                #timeZoneSelector {
                    width: 5em;
                }
            `;
        }
    
    static get properties() {
        return {
            errorbars: {
                type: String,
                notify: true,
                reflect: true
            },

            source: {
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
                type: String,
                notify: true,
                reflect: true
            },

            group: {
                type: String
            }
        };
    }

    render() {        
        this.buildSourceSelector();
        var returnValue = html`
            <div class="link-interaction">
                <nobr>
                    <b>Range:</b>
                    <select id="rangeSelector" @change=${this._zoom}>
                        <option value="10m"    ?selected=${this._quantizedRange === '10m'}>10 Minutes</option>
                        <option value="1h"     ?selected=${this._quantizedRange === '1h'}>Hour</option>
                        <option value="3h"     ?selected=${this._quantizedRange === '3h'}>3 Hour</option>
                        <option value="6h"     ?selected=${this._quantizedRange === '6h'}>6 hour</option>
                        <option value="12h"    ?selected=${this._quantizedRange === '12h'}>12 Hour</option>
                        <option value="1d"     ?selected=${this._quantizedRange === '1d'}>Day</option>
                        <option value="1w"     ?selected=${this._quantizedRange === '1w'}>Week</option>
                        <option value="1month" ?selected=${this._quantizedRange === '1month'}>Month</option>
                        <option disabled       ?selected=${this._quantizedRange === 'custom'}>Custom</option>
                    </select>
                </nobr>
                ${this.getDateTimeChooser(this._quantizedRange === 'custom')}
                <nobr>
                    <b>Error Bars:</b>
                    <select id="errorBarSelector" @change=${this._setErrorBars}>
                        <option value="NONE"   ?selected=${this.errorbars === 'NONE'}>None</option>
                        <option value="MINMAX" ?selected=${this.errorbars === 'MINMAX'}>MinMax</option>
                        <option value="RMS"    ?selected=${this.errorbars === 'RMS'}>RMS</option>
                    </select>
                </nobr>
                <nobr>
                    <b>Timezone:</b>
                    <select id="timeZoneSelector" @change=${this._setTimeZone} >
                        <option value="false" ?selected=${!this.useUTC} data-abbr="Local">Local (${Intl.DateTimeFormat().resolvedOptions().timeZone})</option>
                        <option value="true"  ?selected=${this.useUTC} data-abbr="UTC">UTC</option>
                    </select>
                </nobr>
                <nobr>
                    <b>Bins:</b>
                    <input type="number" id="nBinsSelector" @change=${this._setNBins} min="50" max="5000" step="50" value=${this.nBins}>
                </nobr>
                ${this.sourceSelection}
                </div>`;
        return returnValue;
    }
    
    getDateTimeChooser(show) {
        console.log(new Date(this._toTimeRange(this.range).start).toISOString().slice(0,16));
        console.log(new Date(this._toTimeRange(this.range).end).toISOString());
        if (show) return html`
                <nobr>
                    <input type="datetime-local" id="start-time" name="start-time" @change=${this._customZoom} value="${new Date(this._toTimeRange(this.range).start).toISOString().slice(0,16)}">
                    <input type="datetime-local" id="end-time" name="end-time" @change=${this._customZoom} value="${new Date(this._toTimeRange(this.range).end).toISOString().slice(0,16)}">
                </nobr>
        `;
        else return html``;
    }

    buildSourceSelector() {
        if (this.needsToBuildSourceSelector) {
            let request = new XMLHttpRequest();
            request.open('GET', this.restURL + '/sources', false);
            request.onload = () => {
                if (request.status >= 200 && request.status < 400) {
                    // Success!
                    this.sourceSelection = html``;
                    let content = request.responseText.replace("[", "").replace("]", "").replaceAll("\"", "");
                    var sourceArray = content.split(',');
                    if (sourceArray.length > 1) {
                        this.sourceSelection = [];
                        this.sourceSelection.push(html`<nobr> <b>Source:</b> <select id="sourceSelector" @change=${this._setSource} >
                            <option value="EFD" ?selected=false>EFD</option>
                            <option value="CCS" ?selected=true>CCS</option>`);
                        for (var i = 0; i < sourceArray.length; i++) {
                            var source = sourceArray[i];
                            if ( this.source === `` ) {
                                this.source = source;
                            }
                            this.sourceSelection.push(html`<option value="${source}" ?selected=${this.source === source}>${source}</option>`);
                        }
                        this.sourceSelection.push(html`</select> </nobr>`);
                    }                    
                } else {
                    this._message = `error ( ${this.restURL} returned ${request.status}`;
                }
            };
            request.onerror = () => {
                this._message = `error ( ${this.restURL} returned ${request.status}`;
            };
            request.send();
            this.needsToBuildSourceSelector = false;
        }
    }



    constructor() {
        super();
        this.group = "defaultGroup";
        this.range = _defaultRangeSynchronizer.range;
        this.useUTC = _defaultRangeSynchronizer.useUTC;
        this.errorbars = _defaultRangeSynchronizer.errorbars;
        this.source = '';
        this.nBins = _defaultRangeSynchronizer.nBins;
        this.restURL = 'rest';
        this.sourceSelection = '';
        this.needsToBuildSourceSelector = true;
    }

    firstUpdated(changedProperties) {    
        _rangeSynchronizerForGroup(this.group).add(this);
        _rangeSynchronizerForGroup(this.group).range = this.range;
        _rangeSynchronizerForGroup(this.group).useUTC = this.useUTC;
        _rangeSynchronizerForGroup(this.group).errorbars = this.errorbars;
        _rangeSynchronizerForGroup(this.group).source = this.source;
        _rangeSynchronizerForGroup(this.group).nBins = this.nBins;
    }

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
        _rangeSynchronizerForGroup(this.group).range = this.shadowRoot.querySelector("#rangeSelector").value;
    }

    _customZoom() {
        let start = new Date(this.shadowRoot.querySelector("#start-time").value);
        let end = new Date(this.shadowRoot.querySelector("#end-time").value);
        _rangeSynchronizerForGroup(this.group).range = JSON.stringify({'start': start.getTime(), 'end': end.getTime()});        
    }

    _setErrorBars() {
        _rangeSynchronizerForGroup(this.group).errorbars = this.shadowRoot.querySelector("#errorBarSelector").value;
    }

    _setSource() {
        _rangeSynchronizerForGroup(this.group).source = this.shadowRoot.querySelector("#sourceSelector").value;
    }

    _setTimeZone() {
        let element = this.shadowRoot.querySelector("#timeZoneSelector");
        _rangeSynchronizerForGroup(this.group).useUTC = element.value === 'true';
        element.text = "XYZ";
    }

    _setNBins() {
        _rangeSynchronizerForGroup(this.group).nBins = this.shadowRoot.querySelector("#nBinsSelector").value;
    }

    _computeQuantizedRange() {
        try {
            let rangeInMinutes = Math.round((isNaN(this.range) ? parse(this.range) : this.range) / 1000 / 60);
            switch (rangeInMinutes) {
                case 60:
                    return '1h';
                case 60 * 3:
                    return '3h';
                case 60 * 6:
                    return '6h';
                case 60 * 12:
                    return '12h';
                case 60 * 24:
                    return '1d';
                case 60 * 24 * 7:
                    return '1w';
                case 60 * 24 * 7 * 30:
                    return '1month';
                default:
                    return 'custom';
            }
        } catch (typeerror) {
            return 'custom';
        }
    }
    
    // ToDo: Get rid of cut-paste duplication
    _toTimeRange(range) {
        if (range.startsWith('{')) {
            return JSON.parse(range);
        } else {
            var now = Date.now();
            var then = now - (isNaN(range) ? parse(range) : range);
            return {start: then, end: now};
        }
    }
}

class TrendingGrid extends LitElement {
    static get styles() {
        return css`
            :host {
                display: grid;
                grid-template-rows: auto auto 1fr;
                grid-template-columns: 100%;
                width: 100%;
            }
        `;
    }

    render() {

        return html`
            <style>
                .plot-grid {
                    --repeat: ${this.columns};
                }
                @media (max-width: calc(500px * ${this.columns})) {
                    .plot-grid {
                        --repeat: auto-fit;
                    }                                        
                }                        
                .plot-grid {                        
                    display: grid; 
                    grid-template-columns: repeat(var(--repeat), minmax(500px, 1fr)); 
                    width: 100%;
                }
            </style>
            <div class="plot-grid">
                <slot></slot>
            </div>
        `;
    }

    static get properties() {
        return {
            columns: {
                type: Number,
                notify: true,
                reflect: true
            }
        };
    }

    constructor() {
        super();
        this.columns = 2;
    }
}

customElements.define('trending-grid', TrendingGrid);
customElements.define('trending-plot', TrendingPlot);
customElements.define('trending-data', TrendingData);
customElements.define('trending-controller', TrendingController);
