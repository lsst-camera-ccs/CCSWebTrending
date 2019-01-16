package org.lsst.ccs.web.trending;

import com.jcraft.jsch.JSchException;
import java.net.MalformedURLException;
import java.util.Properties;

/**
 *
 * @author tonyj
 */
public class SiteIR2 extends Site {

    private SiteIR2(Properties props) throws MalformedURLException, JSchException {
        super(props);
    }

    static Site create() throws MalformedURLException, JSchException {
        Properties props = new Properties();
        props.setProperty("name", "ir2");
        props.setProperty("useSSH", "false");
        props.setProperty("restURL", "http://lsst-mcm.slac.stanford.edu:8080/rest/data/dataserver/");
        return new SiteIR2(props);
    }
}
