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
        props.setProperty("useSSH", "true");
        props.setProperty("restURL", "http://10.0.103.106:8080/rest/data/dataserver/");

        props.setProperty("ssh.user", "tonyj");
        props.setProperty("ssh.host", "stargate.lsst.org");
        props.setProperty("ssh.key", "/nfs/slac/g/srs/.ssh/ccs");
        return new SiteComCamTucson(props);
    }    
}
