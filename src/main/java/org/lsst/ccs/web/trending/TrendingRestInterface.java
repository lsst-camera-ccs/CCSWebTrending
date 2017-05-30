package org.lsst.ccs.web.trending;

import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.MediaType;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import javax.xml.xpath.XPath;
import javax.xml.xpath.XPathConstants;
import javax.xml.xpath.XPathExpression;
import javax.xml.xpath.XPathExpressionException;
import javax.xml.xpath.XPathFactory;
import org.w3c.dom.Document;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.SAXException;

/**
 * The restful interface for the sequencer server, implemented using Jersey and
 * Jackson (which make it pretty trivial).
 *
 * @author tonyj
 */
@Path("/")
@Produces(MediaType.APPLICATION_JSON)
public class TrendingRestInterface {

    private static URL restURL;
    private final static Logger logger = Logger.getLogger(TrendingRestInterface.class.getName());
    private static ChannelTree channelTree;

    public TrendingRestInterface() throws IOException {
        if (restURL == null) {
            restURL = new URL("http://lsst-mcm.slac.stanford.edu:8080/rest/data/dataserver/");
            channelTree = new ChannelTree(restURL);
        }
    }

    @GET
    @Path("/channels")
    public Object channels(@QueryParam(value = "id") Integer handle) {
        if (handle == null) {
            return channelTree.getRoot().getChildren();
        } else {
            return channelTree.findNode(handle).getChildren();
        }
    }

    @GET
    public Object trending(
            @QueryParam(value = "key") List<String> keys, @QueryParam(value = "period") String period,
            @QueryParam(value = "t1") Long t1, @QueryParam(value = "t2") Long t2, @QueryParam(value = "n") Integer nBins,
            @QueryParam(value = "flavor") String flavor) throws IOException {
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
            flavor = "stat";
        }
        MergedMap merged = new MergedMap(keys.size());
        DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
        int y = 0;
        for (String key : keys) {
            logger.log(Level.INFO, "Handling {0}", key);
            URL dataURL = new URL(restURL, String.format("data/%s?t1=%s&t2=%s&n=%s&flavor=%s", key, t1, t2, nBins, flavor));
            try (InputStream in = dataURL.openStream()) {
                DocumentBuilder db = dbf.newDocumentBuilder();
                Document doc = db.parse(in);
                logger.log(Level.INFO, "Document created for {0}", key);
                XPathFactory xPathfactory = XPathFactory.newInstance();
                XPath xpath = xPathfactory.newXPath();
                XPathExpression expr = xpath.compile("data/trendingresult/trendingdata");
                NodeList nl = (NodeList) expr.evaluate(doc, XPathConstants.NODESET);
                Map<String, String> map = new LinkedHashMap<>();
                for (int n = 0; n < nl.getLength(); n++) {
                    Node node = nl.item(n);
                    String time = (String) xpath.evaluate("axisvalue[@name='time']/@value", node, XPathConstants.STRING);
                    String value = (String) xpath.evaluate("datavalue[@name='value']/@value", node, XPathConstants.STRING);
                    merged.put(time, value, y);
                }
                logger.log(Level.INFO, "Finished processing for {0}", key);
            } catch (IOException | ParserConfigurationException | SAXException | XPathExpressionException ex) {
                throw new IOException("Error processing restful data from: " + dataURL, ex);
            }
            y++;
        }
        return merged;
    }
}
