package org.lsst.ccs.web.trending;

import com.jcraft.jsch.JSchException;
import java.net.MalformedURLException;
import java.util.Properties;

/**
 *
 * @author tonyj
 */
public class SiteComCamTucson extends Site {
    private SiteComCamTucson(Properties props) throws MalformedURLException, JSchException {
        super(props);
    }

    static Site create() throws MalformedURLException, JSchException {
        Properties props = new Properties();
        props.setProperty("name", "comcam");
        props.setProperty("useSSH", "false");
        props.setProperty("restURL", "http://comcam-db01.ls.lsst.org:8080/rest/data/dataserver/");

        return new SiteComCamTucson(props);
    }    
}
