function CCSTrendingPlot(element, options) {
    var now = Date.now();
    this.title = (typeof options.title === 'undefined') ? 'Trending Plot' : options.title;
    this.range = (typeof options.range === 'undefined') ? {start: new Date(now - 60 * 60 * 1000), end: new Date(now)} : options.range;
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
                series[label] = { 'axis': options.data[key].axis};
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
                    var args = $.param({"key": ccs.keys, "t1": Math.round(minDate), "t2": Math.round(maxDate), "n": ccs.nBins}, true);
                    updateData(args);
                }
            });
    
    this.zoom = function(seconds) {
        var now = Date.now();
        var then = now-seconds*1000;
        graph.updateOptions({dateWindow: [then,now]});
        var args = $.param({"key": ccs.keys, "t1": then, "t2": now, "n": ccs.nBins}, true);
        updateData(args);
    };
    
    function updateData(args) {
        $.getJSON("rest", args).done(function (newData) {
            for (var i = 0; i < newData.length; i++) {
                newData[i][0] = new Date(newData[i][0]);
            }
            graph.updateOptions({file: newData});
        })
        .fail(function (jqXHR, message) {
                    alert("error " + message);
        });
    }

    var args = $.param({"key": this.keys, "t1": this.range.start.getTime(), "t2": this.range.end.getTime(), "n": this.nBins}, true);
    updateData(args);
}