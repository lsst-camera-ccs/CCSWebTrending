/* global Dygraph */

function CCSTrendingPlot(element, options) {
    this.title = (typeof options.title === 'undefined') ? 'Trending Plot' : options.title;
    this.range = (typeof options.range === 'undefined') ? parseRange('1d') : parseRange(options.range);
    this.logscale = (typeof options.logscale === 'undefined') ? false : options.logscale;
    this.errorBars = 'NONE';
    this.data = options.data;
    this.nBins = 100;
    this.restURL = (typeof options.restURL === 'undefined') ? 'rest' : options.restURL;
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
    dummyData[0][0] = this.range.start;
    dummyData[1][0] = this.range.end;

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
                    var args = $.param({"key": ccs.keys, "t1": Math.round(minDate), "t2": Math.round(maxDate), "n": ccs.nBins, 'errorBars': ccs.errorBars}, true);
                    ccs.updateData(ccs.restURL, args);
                }
            });
    graph.ccsInstance = this;
    this.graph = graph;

    this.zoom = function (seconds) {
        var now = Date.now();
        var then = now - seconds * 1000;
        this.range = { start: new Date(then), end: new Date(now) };
        graph.updateOptions({dateWindow: [then, now]});
        var args = $.param({"key": ccs.keys, "t1": then, "t2": now, "n": ccs.nBins}, true);
        this.updateData(ccs.restURL, args);
    };

    this.setErrorBars = function (errorBars) {
        if (errorBars !== this.errorBars) {
            this.errorBars = errorBars;
            var args = $.param({"key": this.keys, "t1": this.range.start.getTime(), "t2": this.range.end.getTime(), "n": this.nBins, 'errorBars': this.errorBars}, true);
            this.updateData(this.restURL, args);
        }
    };
    
    this.setData = function(key, label) {
        this.keys = [key];
        this.labels = ['time', label];
        var series = {};
        //series[label] = {'yAxis': 'y1'};
        graph.updateOptions({'labels': this.labels, 'series': series});
        var args = $.param({"key": this.keys, "t1": this.range.start.getTime(), "t2": this.range.end.getTime(), "n": this.nBins, 'errorBars': this.errorBars}, true);
        this.updateData(this.restURL, args);       
    };
    
    this.addData = function(key, label, options) {
        this.keys.push(key);
        this.labels.push(label);
        series[label] = options;
        graph.updateOptions({'labels': this.labels});
        var args = $.param({"key": this.keys, "t1": this.range.start.getTime(), "t2": this.range.end.getTime(), "n": this.nBins, 'errorBars': this.errorBars}, true);
        this.updateData(this.restURL, args);       
    };
  
    this.resize = function() {
        graph.resize();
    };

    function parseRange(range) {
        var now = Date.now();
        if (typeof range === 'string') {
            var then = now - 24*60*60*1000;
            return  {start: new Date(then), end: new Date(now) };
        } else if (typeof range === 'number') {
            var then = now - range *1000;
            return  {start: new Date(then), end: new Date(now) };
        } else {
            return range;
        }
    }
    this.updateData = function(restURL, args) {
        $.getJSON(restURL, args)
                .done(function (newData) {
                    for (var i = 0; i < newData.data.length; i++) {
                        newData.data[i][0] = new Date(newData.data[i][0]);
                    }
                    var errorBarsType = newData.meta.errorBars;
                    var customBars = errorBarsType==='MINMAX';
                    var errorBars = errorBarsType==='RMS';
                    graph.updateOptions({file: newData.data, customBars: customBars, errorBars: errorBars});
                })
                .fail(function (jqXHR, message) {
                    alert("error " + message);
                });
    }

    var args = $.param({"key": this.keys, "t1": this.range.start.getTime(), "t2": this.range.end.getTime(), "n": this.nBins, 'errorBars': this.errorBars}, true);
    this.updateData(this.restURL, args);

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
                var args = $.param({"key": myInstance.keys, "t1": Math.round(axisX[0]), "t2": Math.round(axisX[1]), "n": myInstance.nBins, 'errorBars': myInstance.errorBars}, true);
                myInstance.updateData(myInstance.restURL, args);
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
                var args = $.param({"key": myInstance.keys, "t1": Math.round(axisX[0]), "t2": Math.round(axisX[1]), "n": myInstance.nBins, 'errorBars': myInstance.errorBars}, true);
                myInstance.updateData(myInstance.restURL, args);
            }
        };
        Dygraph.endPan = Dygraph.Interaction.endPan; //see dygraph-interaction-model.js
        Dygraph.endTouch = Dygraph.Interaction.endTouch; //see dygraph-interaction-model.js
    };

    this._setupPanInteractionHandling();
}

var synchronize = function() {
    graphs = [];
    for (var i = 0; i < arguments.length; i++) {
      if (arguments[i] instanceof CCSTrendingPlot) {
          graphs.push(arguments[i].graph);
      }
    }  
    Dygraph.synchronize(graphs,{zoom: true, range: false, selection: false});
};