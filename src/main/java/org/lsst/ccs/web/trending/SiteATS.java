package org.lsst.ccs.web.trending;

import com.jcraft.jsch.JSchException;
import java.net.MalformedURLException;
import java.util.Properties;

/**
 *
 * @author tonyj
 */
public class SiteATS extends Site {

    private SiteATS(Properties props) throws MalformedURLException, JSchException {
        super(props);
        setSSHTimeout(20000);
    }

    static Site create() throws MalformedURLException, JSchException {
        Properties props = new Properties();
        props.setProperty("name", "ats");
        props.setProperty("useSSH", "true");
        props.setProperty("restURL", "http://atsccs1.cp.lsst.org:8080/rest/data/dataserver/");

        props.setProperty("ssh.user", "tonyj");
        props.setProperty("ssh.host", "stargate.lsst.org");
        props.setProperty("ssh.key", "/nfs/slac/g/srs/.ssh/ccs");
        return new SiteATS(props);
    }
}
