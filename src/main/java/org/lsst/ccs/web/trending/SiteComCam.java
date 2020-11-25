package org.lsst.ccs.web.trending;

import com.jcraft.jsch.JSchException;
import java.net.MalformedURLException;
import java.util.Properties;

/**
 *
 * @author tonyj
 */
public class SiteComCam extends Site {
    private SiteComCam(Properties props) throws MalformedURLException, JSchException {
        super(props);
    }

    static Site create() throws MalformedURLException, JSchException {
        Properties props = new Properties();
        props.setProperty("name", "comcam");
        props.setProperty("useSSH", "false");
        props.setProperty("restURL", "http://comcam-db01.cp.lsst.org:8080/rest/data/dataserver/");

        return new SiteComCam(props);
    }    
}
