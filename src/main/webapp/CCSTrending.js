/* global Dygraph */

function CCSTrendingPlot(element, options) {
    this.title = (typeof options.title === 'undefined') ? 'Trending Plot' : options.title;
    this.range = (typeof options.range === 'undefined') ? parseRange('1d') : parseRange(options.range);
    this.logscale = (typeof options.logscale === 'undefined') ? false : options.logscale;
    this.errorBars = 'NONE';
    this.data = options.data;
    this.nBins = 100;
    this.restURL = (typeof options.restURL === 'undefined') ? 'rest' : options.restURL;
    this.autoUpdate = true;
    this.keys = [];
    this.labels = ['time'];
    var series = {};
    for (var key in options.data) {
        if (options.data.hasOwnProperty(key)) {
            this.keys.push(key);
            var label = typeof options.data[key].title === 'undefined' ? key : options.data[key].title;
            this.labels.push(label);
            if (options.data[key].axis !== 'undefined') {
                series[label] = {'axis': options.data[key].axis};
            }
        }
    }

    var dummyData = [Array.apply(null, Array(this.labels.length)).map(Number.prototype.valueOf, 0), Array.apply(null, Array(this.labels.length)).map(Number.prototype.valueOf, 0)];
    var timeRange = toTimeRange(this.range);
    dummyData[0][0] = new Date(timeRange.start);
    dummyData[1][0] = new Date(timeRange.end);

    var ccs = this;
    var graph = new Dygraph(element, dummyData,
            {
                title: this.title,
                labels: this.labels,
                series: series,
                legend: 'always',
                ylabel: options.ylabel,
                y2label: options.y2label,
                axes: options.axes,
                animatedZooms: true,
                logscale: this.logscale,
                connectSeparatedPoints: true,
                drawPoints: true,
                zoomCallback: function (minDate, maxDate, yRanges) {
                    ccs.range = {"start": new Date(minDate), "end": new Date(maxDate)};
                    ccs.reloadData();
                }
            });
    graph.ccsInstance = this;
    this.graph = graph;

    this.zoom = function (seconds) {
        this.range = seconds;
        this.reloadData();
    };

    this.download = function () {
        var filename = this.title + '.tsv';
        var CSVContent = "";
        //create header
        for (var i = 0; i < this.labels.length; i++) {
            if (i === 0)
                CSVContent = CSVContent + this.labels[i];
            else
                CSVContent = CSVContent + '\t' + this.labels[i];
        }

        //get data
        for (var i = 0; i < this.graph.rawData_.length; i++) {
            CSVContent = CSVContent + '\r' + '\n';
            for (var j = 0; j < this.graph.rawData_[i].length; j++) {
                if (j === 0)
                    CSVContent = CSVContent + ((this.graph.rawData_[i][j] / 86400000) + 25569);
                else
                    CSVContent = CSVContent + '\t' + this.graph.rawData_[i][j];
            }
        }

        //send TSV content to download
        var blob = new Blob([CSVContent], {type: 'text/csv;charset=utf-8;'});
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
    };

    this.reloadData = function () {
        var timeRange = toTimeRange(this.range);
        graph.updateOptions({dateWindow: [timeRange.start, timeRange.end]});
        var args = $.param({"key": this.keys, "t1": timeRange.start, "t2": timeRange.end, "n": this.nBins, 'errorBars': this.errorBars}, true);
        this.updateData(ccs.restURL, args);
    };

    this.setErrorBars = function (errorBars) {
        if (errorBars !== this.errorBars) {
            this.errorBars = errorBars;
            this.reloadData();
        }
    };

    this.setData = function (key, label) {
        this.keys = [key];
        this.labels = ['time', label];
        var series = {};
        //series[label] = {'yAxis': 'y1'};
        graph.updateOptions({'labels': this.labels, 'series': series});
        this.reloadData();
    };

    this.addData = function (key, label, options) {
        this.keys.push(key);
        this.labels.push(label);
        series[label] = options;
        graph.updateOptions({'labels': this.labels});
        this.reloadData();
    };

    this.resize = function () {
        graph.resize();
    };

    function toTimeRange(range) {
        if (typeof range === 'number') {
            var now = Date.now();
            var then = now - range * 1000;
            return  {start: then, end: now};
        } else {
            return {start: range.start.getTime(), end: range.end.getTime()};
        }
    }
    ;

    function parseRange(range) {
        if (typeof range === 'string') {
            return  24 * 60 * 60; // FIXME: This should not be hardwired
        } else if (typeof range === 'number') {
            return range;
        } else {
            return range;
        }
    }
    this.updateData = function (restURL, args) {
        $.getJSON(restURL + '?callback=', args)
                .done(function (newData) {
                    for (var i = 0; i < newData.data.length; i++) {
                        newData.data[i][0] = new Date(newData.data[i][0]);
                    }
                    var errorBarsType = newData.meta.errorBars;
                    var customBars = errorBarsType === 'MINMAX';
                    var errorBars = errorBarsType === 'RMS';
                    graph.updateOptions({file: newData.data, customBars: customBars, errorBars: errorBars});
                })
                .fail(function (jqXHR, textStatus, error) {
                    alert("error (" + restURL + " " + args + ")" + error);
                });
    };
    this.reloadData();

    if (this.autoUpdate) {
        setInterval(function () {
            if (typeof ccs.range === 'number')
                ccs.reloadData();
        }, 60000);
    }

    /*
     * This is based on: https://kaliatech.github.io/dygraphs-dynamiczooming-example/example4.html
     * But it only detects when pans are done using the shift+mouse, not oans doen by dragging or
     * pans initiaited by synchronization between plots
     */
    CCSTrendingPlot.prototype._setupPanInteractionHandling = function () {

        if (CCSTrendingPlot.isGlobalPanInteractionHandlerInstalled)
            return;
        else
            CCSTrendingPlot.isGlobalPanInteractionHandlerInstalled = true;

        //Save original endPan function
        var origEndPan = Dygraph.Interaction.endPan;
        var origEndTouch = Dygraph.Interaction.endTouch;

        //Replace built-in handling with our own function
        Dygraph.Interaction.endPan = function (event, g, context) {

            //Call the original to let it do it's magic
            origEndPan(event, g, context);

            if (g.synchronizer) {
                g.synchronizer();
            } else {
                //Note that this _might_ not work as is in IE8. If not, might require a setTimeout hack that executes these
                //next few lines after a few ms delay. Have not tested with IE8 yet.
                var myInstance = g.ccsInstance;
                //Extract new start/end from the x-axis
                var axisX = g.xAxisRange();
                //Trigger new detail load
                console.log("Pan detected");
                myInstance.range = {"start": new Date(Math.round(axisX[0])), "end": new Date(Math.round(axisX[1]))};
                myInstance.reloadData();
            }
        };
        //Replace built-in handling with our own function
        Dygraph.Interaction.endTouch = function (event, g, context) {

            //Call the original to let it do it's magic
            origEndTouch(event, g, context);

            if (g.synchronizer) {
                g.synchronizer();
            } else {
                //Note that this _might_ not work as is in IE8. If not, might require a setTimeout hack that executes these
                //next few lines after a few ms delay. Have not tested with IE8 yet.
                var myInstance = g.ccsInstance;
                //Extract new start/end from the x-axis
                var axisX = g.xAxisRange();
                //Trigger new detail load
                console.log("Touch detected");
                myInstance.range = {"start": new Date(Math.round(axisX[0])), "end": new Date(Math.round(axisX[1]))};
                myInstance.reloadData();
            }
        };
        Dygraph.endPan = Dygraph.Interaction.endPan; //see dygraph-interaction-model.js
        Dygraph.endTouch = Dygraph.Interaction.endTouch; //see dygraph-interaction-model.js
    };

    this._setupPanInteractionHandling();
}

var synchronize = function () {
    graphs = [];
    for (var i = 0; i < arguments.length; i++) {
        if (arguments[i] instanceof CCSTrendingPlot) {
            graphs.push(arguments[i].graph);
        }
    }
    Dygraph.synchronize(graphs, {zoom: true, range: false, selection: false});
};