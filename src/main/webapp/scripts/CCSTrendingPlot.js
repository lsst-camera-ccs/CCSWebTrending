define(function (require) {
    // Load any app-specific modules
    // with a relative require call,
    // like:
    var Dygraph = require("dygraph");
    var $ = require("jquery");
    
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

        this.legendFormatter = function (data) {
            if (data.x == null) {
                // This happens when there's no selection and {legend: 'always'} is set.
                return data.series.map(function (series, i) {
                    return "<a href=\"#\" class=\"legendElement\" id=\"" + i + "\" style=\"display: inline; color: " + series.color + ";\">" + series.dashHTML + ' ' + series.labelHTML + "</a>";
                }).join('&nbsp;');
            }
            var html = data.xHTML + ":&nbsp;";
            data.series.forEach(function (series) {
                if (!series.isVisible || series.y == null)
                    return;
                var labeledData = series.labelHTML + ': ' + series.yHTML;
                if (series.isHighlighted) {
                    labeledData = '<b>' + labeledData + '</b>';
                }
                html += "<div style=\"display: inline; color: " + series.color + ";\">" + series.dashHTML + ' ' + labeledData + "</div>&nbsp;";
            });
            return html;
        };

        var graph = new Dygraph(element, dummyData,
                {
                    title: this.title,
                    labels: this.labels,
                    series: series,
                    legend: 'always',
                    ylabel: options.ylabel,
                    y2label: options.y2label,
                    axes: options.axes,
                    labelsDiv: document.getElementById("legend"),
                    legendFormatter: this.legendFormatter,
                    endPanCallback: function (minDate, maxDate, yRanges) {
                        if (ccs.synchronizer) {
                            ccs.synchronizer();
                        } else {
                            //Trigger new detail load
                            console.log("Pan detected");
                            var args = $.param({"key": ccs.keys, "t1": Math.round(minDate), "t2": Math.round(maxDate), "n": ccs.nBins, 'errorBars': ccs.errorBars}, true);
                            ccs.updateData(ccs.restURL, args);
                        }
                    },
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
            this.range = {start: new Date(then), end: new Date(now)};
            graph.updateOptions({dateWindow: [then, now]});
            var args = $.param({"key": ccs.keys, "t1": then, "t2": now, "n": ccs.nBins}, true);
            this.updateData(ccs.restURL, args);
        };

        this.toggleVisibility = function (series) {
            this.graph.setVisibility(series, !this.graph.visibility()[series]);
        };

        this.setErrorBars = function (errorBars) {
            if (errorBars !== this.errorBars) {
                this.errorBars = errorBars;
                var args = $.param({"key": this.keys, "t1": this.range.start.getTime(), "t2": this.range.end.getTime(), "n": this.nBins, 'errorBars': this.errorBars}, true);
                this.updateData(this.restURL, args);
            }
        };

        this.setData = function (key, label) {
            this.keys = [key];
            this.labels = ['time', label];
            var series = {};
            //series[label] = {'yAxis': 'y1'};
            graph.updateOptions({'labels': this.labels, 'series': series});
            var args = $.param({"key": this.keys, "t1": this.range.start.getTime(), "t2": this.range.end.getTime(), "n": this.nBins, 'errorBars': this.errorBars}, true);
            this.updateData(this.restURL, args);
        };

        this.addData = function (key, label, options) {
            this.keys.push(key);
            this.labels.push(label);
            series[label] = options;
            graph.updateOptions({'labels': this.labels});
            var args = $.param({"key": this.keys, "t1": this.range.start.getTime(), "t2": this.range.end.getTime(), "n": this.nBins, 'errorBars': this.errorBars}, true);
            this.updateData(this.restURL, args);
        };

        this.resize = function () {
            graph.resize();
        };

        function parseRange(range) {
            var now = Date.now();
            if (typeof range === 'string') {
                var then = now - 24 * 60 * 60 * 1000;
                return  {start: new Date(then), end: new Date(now)};
            } else if (typeof range === 'number') {
                var then = now - range * 1000;
                return  {start: new Date(then), end: new Date(now)};
            } else {
                return range;
            }
        }
        this.updateData = function (restURL, args) {
            $.getJSON(restURL, args)
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

        var args = $.param({"key": this.keys, "t1": this.range.start.getTime(), "t2": this.range.end.getTime(), "n": this.nBins, 'errorBars': this.errorBars}, true);
        this.updateData(this.restURL, args);
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
    return CCSTrendingPlot;
});