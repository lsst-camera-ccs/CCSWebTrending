import { html, css, LitElement } from 'lit-element';
import './ccs-trending.js';
import '@vaadin/vaadin-split-layout';
import jQuery from "jquery";
import {jstree} from 'jstree';
var pretty = require('pretty');

// Note, we do not currently use shadow DOM with these elements, because:
// a) It is not currently compatible with jquery which is used with jstree (maybe jstree 4.x will eventually fix this)
// b) It is not obvious how to make jstree drag and drop work when the drop target is in the shadow DOM
// A side effect of this is that the normal LitElement styles() static method does not work, and styles have to be inserted
// into the rendered HTML.

class TrendingBuilder extends LitElement {

    render() {

        return html`
            <style>
                .plot-grid {
                    flex-grow: 1;
                    overflow: auto;
                    --colNum: ${this.columns};
                    display: grid; 
                    grid-template-columns: repeat(var(--colNum), calc(100% / var(--colNum))); 
                    width: 100%;
                }
                .navbar {
                    flex-grow: 0;
                    display: flex;
                    flex-direction: row;
                }
                #right {
                    display: flex;
                    flex-direction: column;
                    top: 0;
                    right: 0;
                    left: 0;
                    bottom: 0;
                    height: 100%;
                }
            </style>
            <vaadin-split-layout style="height: 100%;">
                <channel-tree restURL=${this.restURL} baseURL=${this.baseURL}></channel-tree>
                <div id="right" stle="width: 100%;">
                    <div class="navbar">
                        <trending-controller range=${this.range} ?useUTC=${this.useUTC}></trending-controller>
                        <div>
                            <button @click=${() => this.plots += 1}>Add Plot</button>
                            <button @click=${() => this.plots -= 1} ?disabled=${this.plots==1}>Remove Plot</button>
                            <button @click=${() => this.columns += 1}>Add Column</button>
                            <button @click=${() => this.columns -= 1} ?disabled=${this.columns==1}>Remove Column</button>
                            <button @click=${this.savePage}>Save page</button>
                        </div>
                    </div>
                    <div class="plot-grid">                   
                        ${Array(this.plots).fill().map((_, i) =>
                            html`<drop-target-plot restURL=${this.restURL} ?useUTC=${this.useUTC} range=${this.range}></drop-target-plot>`
                        )}
                    </div>
                </div>
            </vaadin-split-layout>
        `;
    }
    static get properties() {
        return {
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

            plots: {
                type: Number,
                notify: true,
                reflect: true
            },

            columns: {
                type: Number,
                notify: true,
                reflect: true
            },
            
            baseURL: {
                type: String
            }
        };
    }

    _generatePlots() {
        let result = '';
        let plots = this.querySelectorAll("drop-target-plot");
        plots.forEach((plot) => {
            result += plot._saveAsHtml();
        });
        return result;
    }

    savePage() {
        let filename = 'plotpage.html';
        let controller = this.querySelector("trending-controller");
        let content = `<html>
                <head>
                    <title>CCSTrending Plots</title>
                    <base href="${window.location.href}" target="_blank">
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <script type="module" src="${this.baseURL}ccs-trending.js"></script>
                </head>
                <body>
                    <trending-controller ${controller.useUTC ? "useUTC" : ""} range="${controller.range}" errorbars="${controller.errorbars}"></trending-controller>
                    <trending-grid columns="${this.columns}">
                    ${this._generatePlots()}
                    </trending-grid>
                </body>
            </html>
            `;

        //send file content to download
        let blob = new Blob([pretty(content, {ocd: true})], {type: 'text/html;charset=utf-8;'});
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

    constructor() {
        super();
        this.useUTC = false;
        this.range = "1d";
        this.restURL = "rest";
        this.plots = 1;
        this.columns = 1;
        this.baseURL = "./";
    }

    createRenderRoot() {
        return this;
    }

    firstUpdated(changedProperties) {
        super.firstUpdated();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
    }
}

class NameHelper {

    constructor() {
        this.clear();
    }

    _computeNames() {
        let l = this.paths.length;
        if (l === 0) {
            this.title = "No data";
            this.names = ["No data"];
        } else if (l === 1) {
            this.title = this.paths[0].slice(0, -1).join('/');
            this.names = this.paths[0].slice(-1);
        } else {
            let matches = this.paths[0].slice(0);
            this.paths.slice(1).forEach(function (path) {
                path.forEach(function (token, index) {
                    if (token !== matches[index]) {
                        matches[index] = '*';
                    }
                });
            });
            this.title = matches.join('/');
            let x = this.names = [];
            this.paths.forEach(function (path, index) {
                let name = [];
                path.forEach(function (token, tindex) {
                    if (matches[tindex] === '*') {
                        name.push(token);
                    }
                });
                x.push(name.join('/'));
            });
        }
    }
    
    clear() {
        this.paths = [];
        this.keys = [];
        this.axes = [];
        this._computeNames();
    }
    
    addData(path, key, axis) {
        this.paths.push(path);
        this.keys.push(key);
        this.axes.push(axis);
        this._computeNames();
    }
    
    getTitle() {
        return this.title;
    }
    
    getTrendingData() {
        let result = "";
        for (let i = 0; i < this.paths.length; i++) {
            result += `<trending-data key="${this.keys[i]}" axis="${this.axes[i]}">${this.names[i]}</trending-data>`;
        }
        return result;
    }
}


class DropTargetPlot extends LitElement {

    render() {

        return html`
            <style>
                #drop-target {
                    display: ${this.showDropTarget ? 'grid' : 'none'};
                    grid-template-columns: auto auto auto;
                    column-gap: 20px;
                    padding: 15px;
                    justify-content: space-evenly;

                }
                .drop {
                    background:lime; 
                    border-radius: 10px; 
                    padding: 15px;
                }
                #plot-container {
                    display: grid;
                    grid-template-columns: 100%;
                    justify-items: center;
                    align-items: center;
                }

                #plot-container #graph {
                    grid-area: 1 / 1;
                }

                #plot-container #drop-target {
                    grid-area: 1 / 1;
                    z-index: 10;
                }
            </style>
            <div id="plot-container">    
                <trending-plot id="graph" title="Plot" restURL="${this.restURL}"></trending-plot>
                <div id="drop-target">
                    <span class="drop" id="add">Drop here to plot</span>
                    <span class="drop" id="overlayY1">Drop here to overlay on Y1</span>
                    <span class="drop" id="overlayY2">Drop here to overlay on Y2</span>
                </div>
            </div>
        `;
    }

    static get properties() {
        return {
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

            showDropTarget: {
                type: Boolean,
                notify: true,
                reflect: true
            }
        };
    }

    createRenderRoot() {
        return this;
    }

    constructor() {
        super();
        this.useUTC = false;
        this.range = "1d";
        this.restURL = "rest";
        this._nh = new NameHelper();
        this.showDropTarget = false;
    }

    static initialize() {
        jQuery(document).on('dnd_move.vakata', (e, data) => {
            let t = data.event.target;

            if (!t.closest('.jstree')) {
                if (t.closest('.drop')) {
                    let icon = data.helper[0].querySelector('.jstree-icon');
                    let classList = icon.classList;
                    classList.remove('jstree-er');
                    classList.add('jstree-ok');
                    // Not clear why the above no longer appears to work!
                    icon.style["background-position"] = "-7px -68px";
                } else {
                    let icon = data.helper[0].querySelector('.jstree-icon');
                    let classList = icon.classList;
                    classList.remove('jstree-ok');
                    classList.add('jstree-er');
                    // Not clear why the above no longer appears to work!
                    icon.style["background-position"] = "-39px -68px";
                }
            }
        });
    }

    firstUpdated(changedProperties) {
        super.firstUpdated();
        let g = this.querySelector("trending-plot");
        jQuery(document)
                .on('dnd_start.vakata', (e, data) => {
                    this.showDropTarget = true;
                })
                .on('dnd_stop.vakata', (e, data) => {
                    let t = data.event.target;
                    if (!t.closest('.jstree') && t.closest('drop-target-plot') === this) {
                        if (t.closest('.drop')) {
                            data.data.nodes.forEach((nodeId, index) => {
                                let node = data.data.origin.get_node(nodeId);
                                if (t.closest('.drop').id === 'add') {
                                    if (index === 0) {
                                        this._nh.clear();
                                        this._nh.addData(this._pathForNode(data.data.origin, node), node.data, "y1");
                                    } else {
                                        this._nh.addData(this._pathForNode(data.data.origin, node), node.data, "y1");
                                    }
                                } else if (t.closest('.drop').id === 'overlayY1') {
                                    this._nh.addData(this._pathForNode(data.data.origin, node), node.data, "y1");
                                } else if (t.closest('.drop').id === 'overlayY2') {
                                    this._nh.addData(this._pathForNode(data.data.origin, node), node.data, "y2");
                                }
                            });
                            g.innerHTML = this._nh.getTrendingData();
                            g.title = this._nh.getTitle();
                            g._updateData();
                        }
                    }
                    this.showDropTarget = false;
                });

    }

    _pathForNode(jsTree, node) {
        let result = node.text.split('/');
        for (const id of node.parents) {
            let text = jsTree.get_node(id).text;
            if (typeof text !== 'undefined') {
                let split = text.split('/');
                for (const s of split.reverse())
                    result.unshift(s);
            }
        }
        return result;
    }

    _saveAsHtml() {
        let result = `<trending-plot restURL="${this.restURL}" ${this.useUTC ? "useUTC" : ""} title="${this._nh.getTitle()}">\n`;
        result += this._nh.getTrendingData();
        result += `</trending-plot>\n`;
        return result;
    }
}

DropTargetPlot.initialize();

class ChannelTree extends LitElement {

    render() {

        return html`
           <link rel="stylesheet" href="//cdnjs.cloudflare.com/ajax/libs/jstree/3.3.9/themes/default/style.min.css" />
           <style>
                .jstree-leaf .jstree-anchor .jstree-themeicon { 
                    background: url("${this.baseURL}data.png") 6px 0px no-repeat !important; background-repeat: no-repeat; 
                }
                #filter-div {
                    flex-grow: 0;
                }
                #filter-div label {
                    display: flex;
                    flex-direction: row;
                }
                #filter-div #filter-tree {
                    flex-grow: 1;
                    min-width: 50px;
                }
                #left {
                    display: flex;
                    flex-direction: column;
                    top: 0;
                    right: 0;
                    left: 0;
                    bottom: 0;
                    height: 100%;
                }
                #channel_tree {
                    flex-grow: 1;
                    overflow: auto;
                }        
            </style>
            <div id="left">
                <div id="filter-div"><label for="filter" @change=${this._search}>Filter:&nbsp;<input type="search" id="filter-tree" placeholder="**/*memory"></label></div>
                <div id="channel_tree"></div>
            </div>
        `;
    }
    static get properties() {
        return {
            restURL: {
                type: String
            },
            
            baseURL: {
                type: String
            }
        };
    }

    constructor() {
        super();
        this.restURL = "rest";
        this.baseURL = "./";
    }

    createRenderRoot() {
        return this;
    }

    firstUpdated(changedProperties) {
        super.firstUpdated();
        jQuery("#channel_tree").jstree({
            'plugins': ['dnd'],
            'core': {
                'data': {
                    'url': `${this.restURL}/channels`,
                    'data': function (node) {
                        if (node.id === '#')
                            return {};
                        else
                            return {'id': node.id};
                    }
                }
            }
        }).bind("dblclick.jstree", (event) => {
            var node = this.tree.get_node(event.target);
            if (node.data) {
                console.log("Double Click");
            }
        });
        this.tree = jQuery("#channel_tree").jstree(true);
    }

    _search() {
        let filter = this.querySelector('#filter-tree').value;
        this.tree.settings.core.data.url = `${this.restURL}/channels?filter=${filter}`;
        this.tree.refresh();
    }
}

customElements.define('channel-tree', ChannelTree);
customElements.define('trending-builder', TrendingBuilder);
customElements.define('drop-target-plot', DropTargetPlot);