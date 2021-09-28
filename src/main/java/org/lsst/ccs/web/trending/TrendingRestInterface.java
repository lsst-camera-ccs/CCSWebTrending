package org.lsst.ccs.web.trending;

import com.jcraft.jsch.JSchException;
import java.io.IOException;
import java.io.InputStream;
import java.net.MalformedURLException;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.MediaType;
import javax.xml.parsers.ParserConfigurationException;
import javax.xml.parsers.SAXParser;
import javax.xml.parsers.SAXParserFactory;
import org.xml.sax.Attributes;
import org.xml.sax.SAXException;
import org.xml.sax.helpers.DefaultHandler;

/**
 * The restful interface for the sequencer server, implemented using Jersey and
 * Jackson (which make it pretty trivial).
 *
 * @author tonyj
 */
@Path("/")
@Produces(MediaType.APPLICATION_JSON)
public class TrendingRestInterface {

    private final static Logger LOG = Logger.getLogger(TrendingRestInterface.class.getName());
    private static final Map<String, Site> sites = new HashMap<>();
    private static Site defaultSite;
    private final static Pattern SYNTAX_FILTER_PATTERN = Pattern.compile("(?:([a-z]+):)?(.*)");

    static {
        try {
            Site ir2 = SiteIR2.create();
            sites.put(ir2.getName(), ir2);
            defaultSite = ir2;
        } catch (JSchException | MalformedURLException | RuntimeException | UnknownHostException ex) {
            LOG.log(Level.SEVERE, "Failed to initialize sites", ex);
        }
        try {
            Site ats = SiteATS.create();
            sites.put(ats.getName(), ats);
        } catch (JSchException | MalformedURLException | RuntimeException ex) {
            LOG.log(Level.SEVERE, "Failed to initialize sites", ex);
        }
        try {
            Site comcam = SiteComCam.create();
            sites.put(comcam.getName(), comcam);
        } catch (JSchException | MalformedURLException | RuntimeException ex) {
            LOG.log(Level.SEVERE, "Failed to initialize sites", ex);
        }
    }

    public enum ErrorBars {
        NONE, MINMAX, RMS
    };

    public enum Flavor {
        STAT, RAW
    };

    public TrendingRestInterface() throws IOException {
    }

    @GET
    @Path("/channels")
    public Object channels(
            @QueryParam(value = "id") Integer handle,
            @QueryParam(value = "filter") String filter, 
            @QueryParam(value = "flatten") Boolean flatten,
            @QueryParam(value = "refresh") Boolean refresh) throws IOException {
        return channels("", handle, filter, flatten, refresh);
    }

    @GET
    @Path("/{site}/channels")
    public Object channels(@PathParam(value = "site") String siteName,
            @QueryParam(value = "id") Integer handle,
            @QueryParam(value = "filter") String filter,
            @QueryParam(value = "flatten") Boolean flatten,
            @QueryParam(value = "refresh") Boolean refresh) throws IOException {
        Site site = defaultSite;
        if (!siteName.isEmpty()) {
            site = sites.get(siteName);
            if (site == null) {
                throw new RuntimeException("Unknown site " + siteName);
            }
        }

        ChannelTree tree = site.getChannelTree(refresh == null ? false : refresh);
        if (filter != null && !filter.isEmpty()) {
            try {
                Matcher matcher = SYNTAX_FILTER_PATTERN.matcher(filter);
                if (!matcher.matches()) {
                    throw new RuntimeException("Unknown syntax: " + filter);
                }
                String syntax = matcher.group(1);
                String regexp = matcher.group(2);
                if (syntax == null || syntax.isEmpty() || "glob".equals(syntax)) {
                    regexp = Globs.toUnixRegexPattern(regexp);
                } else if (!"regex".equals(syntax)) {
                    throw new RuntimeException("Unknown syntax: " + syntax);
                }
                tree = tree.filter(Pattern.compile(regexp, Pattern.CASE_INSENSITIVE));
                if (flatten == null || flatten) {
                    tree = tree.flatten();
                }
            } catch (RuntimeException x) {
                return new ChannelTree("Invalid filter: " + x.getMessage()).getRoot().getChildren();
            }
        }
        if (tree.getRoot().getChildren().isEmpty()) {
            return new ChannelTree("Filter returned no results").getRoot().getChildren();
        }

        if (handle == null) {
            return tree.getRoot().getChildren();
        } else {
            return tree.findNode(handle).getChildren();
        }
    }

    @GET
    public Object trending(
            @QueryParam(value = "key") List<String> keys, @QueryParam(value = "period") String period,
            @QueryParam(value = "t1") Long t1, @QueryParam(value = "t2") Long t2, @QueryParam(value = "n") Integer nBins,
            @QueryParam(value = "flavor") Flavor flavor, @QueryParam(value = "errorBars") ErrorBars errorBars) throws IOException {
        return trending("", keys, period, t1, t2, nBins, flavor, errorBars);
    }

    @GET
    @Path("{site}")
    public Object trending(
            @PathParam(value = "site") String siteName,
            @QueryParam(value = "key") List<String> keys, @QueryParam(value = "period") String period,
            @QueryParam(value = "t1") Long t1, @QueryParam(value = "t2") Long t2, @QueryParam(value = "n") Integer nBins,
            @QueryParam(value = "flavor") Flavor flavor, @QueryParam(value = "errorBars") ErrorBars errorBars) throws IOException {

        Site site = defaultSite;
        if (!siteName.isEmpty()) {
            site = sites.get(siteName);
            if (site == null) {
                throw new RuntimeException("Unknown site " + siteName);
            }
        }
        long now = System.currentTimeMillis();
        long delta = 60 * 60 * 1000;
        if (period != null) {
            delta = 12 * 60 * 60 * 1000;
        }
        if (t1 == null) {
            t1 = now - delta;
        }
        if (t2 == null) {
            t2 = now;
        }
        if (nBins == null) {
            nBins = 100;
        }
        if (flavor == null) {
            flavor = Flavor.STAT;
        }
        if (errorBars == null) {
            errorBars = ErrorBars.NONE;
        }
        TrendingMetaData meta = new TrendingMetaData(errorBars, nBins, t1, t2, flavor);
        MergedMap merged = new MergedMap(keys.size(), errorBars);
        StringBuilder allKeys = new StringBuilder();
        for (String key : keys) {
            allKeys.append("id=").append(key).append('&');
        }
        String dataURL = String.format("data/?%st1=%s&t2=%s&n=%s&flavor=%s", allKeys, t1, t2, nBins, flavor.toString().toLowerCase());
        LOG.log(Level.INFO, "Reading: {0}", dataURL);
        try (InputStream in = site.openURL(dataURL)) {
            SAXParserFactory factory = SAXParserFactory.newInstance();
            SAXParser saxParser = factory.newSAXParser();
            DefaultHandler handler = new DefaultHandler() {

                private int y = 0;
                private String time;
                private String value;
                private String rms;
                private String min;
                private String max;
                private String units;
                private String format;
                private String description;
                private String state;

                @Override
                public void startElement(String uri, String localName, String qName, Attributes attributes) throws SAXException {
                    switch (qName) {
                        case "trendingdata":
                            time = value = rms = min = max = "NaN";
                            break;
                        case "axisvalue":
                            time = attributes.getValue("value");
                            break;
                        case "datavalue":
                            switch (attributes.getValue("name")) {
                                case "value":
                                    value = attributes.getValue("value");
                                    break;
                                case "rms":
                                    rms = attributes.getValue("value");
                                    break;
                                case "min":
                                    min = attributes.getValue("value");
                                    break;
                                case "max":
                                    max = attributes.getValue("value");
                                    break;
                            }
                            break;
                        case "channelmetadata":
                            units = format = description = state = null;
                            break;
                        case "channelmetadatavalue":
                            switch (attributes.getValue("name")) {
                                case "units":
                                    units = attributes.getValue("value");
                                    break;
                                case "format":
                                    format = attributes.getValue("value");
                                    break;
                                case "description":
                                    description = attributes.getValue("value");
                                    break;
                                case "state":
                                    state = attributes.getValue("value");
                                    break;
                            }
                            break;
                    }
                }

                @Override
                public void endElement(String uri, String localName, String qName) throws SAXException {
                    switch (qName) {
                        case "trendingdata":
                            merged.put(time, value, rms, min, max, y);
                            break;
                        case "data":
                            y++;
                            break;
                        case "channelmetadata":
                            meta.addMetaData(units, format, description, state);
                            break;
                    }
                }

            };
            saxParser.parse(in, handler, "data");

        } catch (IOException | ParserConfigurationException | SAXException ex) {
            throw new IOException("Error processing restful data from: " + dataURL, ex);
        }
        return new TrendingResult(meta, merged);
    }

    private static class TrendingResult {

        private final TrendingMetaData meta;
        private final MergedMap data;

        public TrendingResult(TrendingMetaData meta, MergedMap data) {
            this.meta = meta;
            this.data = data;
        }

        public TrendingMetaData getMeta() {
            return meta;
        }

        public MergedMap getData() {
            return data;
        }

    }

    private static class TrendingPerSeriesMetaData {

        private final String units;
        private final String format;
        private final String description;
        private final String state;

        public TrendingPerSeriesMetaData(String units, String format, String description, String state) {
            this.units = units;
            this.format = format;
            this.description = description;
            this.state = state;
        }

        public String getUnits() {
            return units;
        }

        public String getFormat() {
            return format;
        }

        public String getDescription() {
            return description;
        }

        public String getState() {
            return state;
        }
    }

    private static class TrendingMetaData {

        private final ErrorBars errorBars;
        private final int nBins;
        private final long min;
        private final long max;
        private final Flavor flavor;
        private final List<TrendingPerSeriesMetaData> perData = new ArrayList<>();

        public TrendingMetaData(ErrorBars errorBars, int nBins, long min, long max, Flavor flavor) {
            this.errorBars = errorBars;
            this.nBins = nBins;
            this.min = min;
            this.max = max;
            this.flavor = flavor;
        }

        public ErrorBars getErrorBars() {
            return errorBars;
        }

        public int getnBins() {
            return nBins;
        }

        public long getMin() {
            return min;
        }

        public long getMax() {
            return max;
        }

        public Flavor getFlavor() {
            return flavor;
        }

        public List<TrendingPerSeriesMetaData> getPerData() {
            return perData;
        }

        private void addMetaData(String units, String format, String description, String state) {
            perData.add(new TrendingPerSeriesMetaData(units, format, description, state));
        }

    }
}
