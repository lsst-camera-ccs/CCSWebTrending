package org.lsst.ccs.web.trending;

import com.jcraft.jsch.JSchException;
import java.net.InetAddress;
import java.net.MalformedURLException;
import java.net.UnknownHostException;
import java.util.Properties;
import java.util.logging.Logger;

/**
 *
 * @author tonyj
 */
public class SiteIR2 extends Site {

    private static final Logger LOG = Logger.getLogger(SiteIR2.class.getName());
    
    
    private SiteIR2(Properties props) throws MalformedURLException, JSchException {
        super(props);
    }

    static Site create() throws MalformedURLException, JSchException, UnknownHostException {
        LOG.info("Setting up SiteIR2 for host address: "+InetAddress.getLocalHost().getHostAddress());
        Properties props = new Properties();
        props.setProperty("name", "ir2");
        props.setProperty("useSSH", 
                InetAddress.getLocalHost().getHostAddress().startsWith("134.79.") || 
                InetAddress.getLocalHost().getHostAddress().startsWith("139.229.") || 
                InetAddress.getLocalHost().getHostAddress().startsWith("192.168.") ? "false" : "true");
        props.setProperty("restURL", "http://lsst-mcm.slac.stanford.edu:8080/rest/data/dataserver/");
        // These are only used when testing offsite
        props.setProperty("ssh.user", "tonyj");
        props.setProperty("ssh.host", "lsst-it01.slac.stanford.edu");
        props.setProperty("ssh.key", "/home/tonyj/.ssh/id_rsa");
        props.setProperty("ssh.key.password", "arun2000");
        
        return new SiteIR2(props);
    }
}
