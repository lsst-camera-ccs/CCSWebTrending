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
        props.setProperty("useSSH", "true");
        props.setProperty("restURL", "http://lsst-mcm.slac.stanford.edu:8080/rest/data/dataserver/");
        
        props.setProperty("ssh.user", "tonyj");
        props.setProperty("ssh.host", "exodata01.slac.stanford.edu");
        props.setProperty("ssh.key", "/home/tonyj/.ssh/id_rsa");
        props.setProperty("ssh.key.password", "arun2000");

        return new SiteIR2(props);
    }
}
