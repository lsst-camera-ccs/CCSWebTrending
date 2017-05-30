package org.lsst.ccs.web.trending;


import java.io.PrintWriter;
import java.util.Map;
import java.util.SortedMap;
import java.util.TreeMap;

/**
 * A special map for building CSV files from sets of trending data
 *
 * @author tonyj
 */
class MergedMap {

    private final SortedMap<Long, Double[]> map = new TreeMap<>();
    private final int nSets;

    public MergedMap(int nSets) {
        this.nSets = nSets;
    }

    void put(String timeString, String valueString, int axis) {
        long time = Long.parseLong(timeString);
        double value = Double.parseDouble(valueString);
        Double[] values = map.get(time);
        if (values == null) {
            values = new Double[nSets];
            map.put(time, values);
        }
        values[axis] = value;
    }

    public SortedMap<Long, Double[]> getMap() {
        return map;
    }

}
