/* global Dygraph */

function CCSTrendingPlot(element, options) {
    var now = Date.now();
    this.title = (typeof options.title === 'undefined') ? 'Trending Plot' : options.title;
    this.range = (typeof options.range === 'undefined') ? parseRange('1d') : parseRange(options.range);
    this.errorBars = 'NONE';
    this.data = options.data;
    this.nBins = 100;
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
                animatedZooms: true,
                connectSeparatedPoints: true,
                drawPoints: true,
                zoomCallback: function (minDate, maxDate, yRanges) {
                    var args = $.param({"key": ccs.keys, "t1": Math.round(minDate), "t2": Math.round(maxDate), "n": ccs.nBins, 'errorBars': ccs.errorBars}, true);
                    updateData(args);
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
        updateData(args);
    };

    this.setErrorBars = function (errorBars) {
        if (errorBars !== this.errorBars) {
            this.errorBars = errorBars;
            var args = $.param({"key": this.keys, "t1": this.range.start.getTime(), "t2": this.range.end.getTime(), "n": this.nBins, 'errorBars': this.errorBars}, true);
            updateData(args);
        }
    };
    
    this.setData = function(key, label) {
        this.keys = [key];
        this.labels = ['time', label];
        var series = {};
        //series[label] = {'yAxis': 'y1'};
        graph.updateOptions({'labels': this.labels, 'series': series});
        var args = $.param({"key": this.keys, "t1": this.range.start.getTime(), "t2": this.range.end.getTime(), "n": this.nBins, 'errorBars': this.errorBars}, true);
        updateData(args);       
    };
    
    this.addData = function(key, label) {
        this.keys.push(key);
        this.labels.push(label);
        graph.updateOptions({'labels': this.labels});
        var args = $.param({"key": this.keys, "t1": this.range.start.getTime(), "t2": this.range.end.getTime(), "n": this.nBins, 'errorBars': this.errorBars}, true);
        updateData(args);       
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
    function updateData(args) {
        $.getJSON("rest", args)
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
    updateData(args);

    CCSTrendingPlot.prototype._setupPanInteractionHandling = function () {

        if (CCSTrendingPlot.isGlobalPanInteractionHandlerInstalled)
            return;
        else
            CCSTrendingPlot.isGlobalPanInteractionHandlerInstalled = true;

        //Save original endPan function
        var origEndPan = Dygraph.Interaction.endPan;

        //Replace built-in handling with our own function
        Dygraph.Interaction.endPan = function (event, g, context) {

            var myInstance = graph.ccsInstance;

            //Call the original to let it do it's magic
            origEndPan(event, g, context);

            //Extract new start/end from the x-axis

            //Note that this _might_ not work as is in IE8. If not, might require a setTimeout hack that executes these
            //next few lines after a few ms delay. Have not tested with IE8 yet.
            var axisX = g.xAxisRange();

            //Trigger new detail load
            console.log("Pan detected");
            var args = $.param({"key": ccs.keys, "t1": Math.round(axisX[0]), "t2": Math.round(axisX[1]), "n": ccs.nBins, 'errorBars': ccs.errorBars}, true);
            updateData(args);
        };
        Dygraph.endPan = Dygraph.Interaction.endPan; //see dygraph-interaction-model.js
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
}