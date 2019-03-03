requirejs.config({
    paths: {
        dygraph: '../dygraph/dygraph',
        jquery: 'jquery-3.3.1.min'
    }
});

// Start loading the main app file. Put all of
// your application logic in there.
requirejs(['CCSTrendingPlot']);