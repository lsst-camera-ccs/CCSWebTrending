"use strict";
/* global customElements */

const template = document.createElement('template');
template.innerHTML = `
                        <style>
                          :host {
                             width: 100%;
                          }
                          .graph {
                            width: 100%;
                            height:400px;
                          }
                          .legend {
                            width: 100%;
                          }
                        </style>
                        <h2 class="title">Title</h2>
                        <div class="legend">Legend</div>
                        <div class="graph"></div>
                      `;

class TrendingPlot extends HTMLElement {
    static get observedAttributes() {
        return ['title', 'range', 'errorbars'];
    }

    constructor() {
        super();
        //this.attachShadow({mode: 'open'});
        //this.shadowRoot.appendChild(template.content.cloneNode(true));
        this.labels = ['time'];
        this.restURL = 'rest';
        this.nBins = 100;
        //this.errorBars = 'NONE';
        this.keys = [];

        document.addEventListener("DOMContentLoaded", ()  => {
            let data = this.querySelectorAll('trending-data');
            data.forEach((node) => {
                this.keys.push(node.key);
                this.labels.push(node.label);
            });
            this._updateData();
        });
    }

    /**
     * connectedCallback() will run once the element is attached to the document.
     */
    connectedCallback() {
        this.appendChild(template.content.cloneNode(true));
        this._updateTitle();
        this.querySelector(".legend").toggleVisibility = (series) => { this._toggleVisibility(series); };


            let dummyData = [Array.apply(null, Array(this.labels.length)).map(Number.prototype.valueOf, 0), Array.apply(null, Array(this.labels.length)).map(Number.prototype.valueOf, 0)];
            dummyData[0][0] = this.range.start;
            dummyData[1][0] = this.range.end;
            this.graph = new Dygraph(this.querySelector('.graph'), dummyData, {
                labels: this.labels,
                legend: 'always',
                ylabel: this.ylabel,
                y2label: this.y2label,
                labelsDiv: this.querySelector('.legend'),
                animatedZooms: true,
                logscale: this.logscale,
                connectSeparatedPoints: true,
                drawPoints: true,
                legendFormatter: this._legendFormatter,
                endPanCallback: (minDate, maxDate, yRanges) => {
                    if (this._synchronizer) {
                        this._synchronizer();
                    } else {
                        //Trigger new detail load
                        console.log("Pan detected");
                        this.range = `${Math.round(minDate)}:${Math.round(maxDate)}`;
                    }
                },
                zoomCallback: (minDate, maxDate, yRanges) => {
                    console.log(minDate);
                    console.log("Zoom detected: "+`${minDate}:${maxDate}`);                        
                    this.range = `${Math.round(minDate)}:${Math.round(maxDate)}`;
                }
            });
    }

    get title() {
        const value = this.getAttribute('title');
        return value === null ? '' : value;
    }

    set title(value) {
        this.setAttribute('title', value);
    }

    get ylabel() {
        const value = this.getAttribute('ylabel');
        return value === null ? '' : value;
    }

    set ylabel(value) {
        this.setAttribute('ylabel', value);
    }

    get y2label() {
        const value = this.getAttribute('y2label');
        return value === null ? '' : value;
    }

    set y2label(value) {
        this.setAttribute('y2label', value);
    }

    get range() {
        const value = this.getAttribute('range');
        return value === null ? this._parseRange('1d') : this._parseRange(value);
    }

    set range(value) {
        this.setAttribute('range', value);
    }

    get logscale() {
        const value = this.getAttribute('logscale');
        return value === null ? false : true;
    }

    set logscale(value) {
        this.setAttribute('logscale', value ? "false" : "true");
    }

    get errorbars() {
        const value = this.getAttribute('errorbars');
        return value === null ? "NONE" : value;
    }

    set errorbars(value) {
        this.setAttribute('errorbars', value);
    }

    attributeChangedCallback(name, oldVal, newVal) {
        if (name === 'title') {
            this._updateTitle();
        } else if (name === 'range') {
            this._updateRange();
        } else if (name === 'errorbars') {
            this._updateErrorBars();
        }
    }

    _parseRange(range) {
        let now = Date.now();
        if (isNaN(range)) {
            let match = /(\d+):(\d+)/.exec(range);
            if (match) {
                console.log({start: match[1], end: match[2]});
                return {start: new Date(parseInt(match[1])), end: new Date(parseInt(match[2]))};
            } else {
                var then = now - 24 * 60 * 60 * 1000; // FIXME
                return  {start: new Date(then), end: new Date(now)};
            }
        } else {
            var then = now - range * 1000;
            return  {start: new Date(then), end: new Date(now)};
        }
    }

    _updateTitle() {
        let title = this.querySelector('.title');
        if (title) {
            title.innerHTML = this.title;
        }
    }

    _updateRange() {
        this.graph.updateOptions({dateWindow: [this.range.start.getTime(), this.range.end.getTime()]});
        this._updateData();
    }

    _updateErrorBars() {
        this._updateData();
    }
    
    _toggleVisibility(series) {
        this.graph.setVisibility(series, !this.graph.visibility()[series]);
    };

    _updateData() {
            let args = $.param({"key": this.keys, "t1": this.range.start.getTime(), "t2": this.range.end.getTime(), "n": this.nBins, 'errorBars': this.errorbars}, true);
            console.log("update "+args);
            if (typeof(this.graph) !== "undefined") {
                $.getJSON(this.restURL, args)
                        .done((newData) => {
                            for (var i = 0; i < newData.data.length; i++) {
                                newData.data[i][0] = new Date(newData.data[i][0]);
                            }
                            let errorBarsType = newData.meta.errorBars;
                            let customBars = errorBarsType === 'MINMAX';
                            let errorBars = errorBarsType === 'RMS';
                            this.graph.updateOptions({file: newData.data, customBars: customBars, errorBars: errorBars, labels: this.labels});
                        })
                        .fail((jqXHR, textStatus, error) => {
                            alert("error (" + this.restURL + " " + args + ")" + error);
                        });
            }
    }

    _legendFormatter(data) {
        if (typeof (data.x) === "undefined") {
            // This happens when there's no selection and {legend: 'always'} is set.
            return data.series.map(function (series, i) {
                return `<div class="legendElement" style="display: inline; color: ${series.color};">
                        <input id="${i}" type="checkbox" ${series.isVisible ? "checked" : ""} 
                               onclick="this.closest('.legend').toggleVisibility(this.id)">${series.dashHTML} ${series.labelHTML}</div>`;
            }).join('&nbsp;');
        }
        var html = data.xHTML + ":&nbsp;";
        data.series.forEach(function (series) {
            if (!series.isVisible || typeof(series.y) === "undefined")
                return;
            var labeledData = series.labelHTML + ': ' + series.yHTML;
            if (series.isHighlighted) {
                labeledData = '<b>' + labeledData + '</b>';
            }
            html += `<div style="display: inline; color: ${series.color};">${series.dashHTML} ${labeledData}</div>&nbsp;`;
        });
        return html;
    }
}

class TrendingData extends HTMLElement {
    constructor() {
        super();
    }
    connectedCallback() {
        console.log("data connected");
    }

    get key() {
        const value = this.getAttribute('key');
        return value === null ? 0 : value;
    }

    set key(value) {
        this.setAttribute('key', value);
    }

    get label() {
        return this.innerHTML;
    }
}

const controllerTemplate = document.createElement('template');
controllerTemplate.innerHTML = `
        <div class="link-interaction">
            <style scoped>.link-interaction a:visited { color: blue; }</style>
            <div id="div_g"></div>
            <b>Zoom:</b>
            <a href="#" onclick="this.closest('.link-interaction').zoom(60)" id="hour">hour</a> 
            <a href="#" onclick="this.closest('.link-interaction').zoom(3*60)" id="3hour">3 hour</a> 
            <a href="#" onclick="this.closest('.link-interaction').zoom(6*60)" id="6hour">6 hour</a> 
            <a href="#" onclick="this.closest('.link-interaction').zoom(12*60)" id="12hour">12 hour</a> 
            <a href="#" onclick="this.closest('.link-interaction').zoom(24*60)" id="day">day</a> 
            <a href="#" onclick="this.closest('.link-interaction').zoom(7*24*60)" id="week">week</a> 
            <a href="#" onclick="this.closest('.link-interaction').zoom(31*24*60)" id="month">month</a>.
            Or drag to select area for zoom, or shift drag to pan.<br>
            <b>Error Bars:</b> 
            <a href="#" onclick="this.closest('.link-interaction').setErrorBars('NONE')" id="none">none</a> 
            <a href="#" onclick="this.closest('.link-interaction').setErrorBars('MINMAX')" id="minmax">min/max</a> 
            <a href="#" onclick="this.closest('.link-interaction').setErrorBars('RMS')" id="rms">rms</a> 
        </div>`;

class TrendingController extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({mode: 'open'});
        this.shadowRoot.appendChild(controllerTemplate.content.cloneNode(true));
        this.shadowRoot.querySelector(".link-interaction").zoom = this._zoom;
        this.shadowRoot.querySelector(".link-interaction").setErrorBars = this._setErrorBars;
    }

    _zoom(minutes) {
        document.querySelectorAll("trending-plot").forEach(function (plot) {
            plot.range = minutes * 60;
        });
    }

    _setErrorBars(type) {
        document.querySelectorAll("trending-plot").forEach(function (plot) {
            plot.errorbars = type;
        });
    }

}

customElements.define('trending-plot', TrendingPlot);
customElements.define('trending-data', TrendingData);
customElements.define('trending-controller', TrendingController);
