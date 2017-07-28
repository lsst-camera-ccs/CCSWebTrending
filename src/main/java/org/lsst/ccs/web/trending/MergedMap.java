package org.lsst.ccs.web.trending;

import java.util.SortedMap;
import java.util.TreeMap;
import org.lsst.ccs.web.trending.TrendingRestInterface.ErrorBars;

/**
 * A special map for building CSV files from sets of trending data
 *
 * @author tonyj
 */
class MergedMap {

    private final SortedMap<Long, Bin[]> map = new TreeMap<>();
    private final int nSets;
    private final ErrorBars errorBars;

    public MergedMap(int nSets, ErrorBars errorBars) {
        this.nSets = nSets;
        this.errorBars = errorBars;
    }

    void put(String timeString, String valueString, String rmsString, String minString, String maxString, int axis) {
        long time = Long.parseLong(timeString);
        Bin[] bins = map.get(time);
        if (bins == null) {
            bins = new Bin[nSets];
            map.put(time, bins);
        }
        bins[axis] = new Bin(valueString, rmsString, minString, maxString);
    }

    public SortedMap<Long, Bin[]> getMap() {
        return map;
    }

    public ErrorBars getErrorBars() {
        return errorBars;
    }

    static class Bin {
        private final double value;
        private final double rms;
        private final double min;
        private final double max;

        private Bin(String valueString, String rmsString, String minString, String maxString) {
           value = Double.parseDouble(valueString);
           rms = Double.parseDouble(rmsString);
           min = Double.parseDouble(minString);
           max = Double.parseDouble(maxString);
        }

        double getValue() {
            return value;
        }

        double getRMS() {
            return rms;
        }

        double getMin() {
            return min;
        }

        double getMax() {
            return max;
        }
        
    }
}
