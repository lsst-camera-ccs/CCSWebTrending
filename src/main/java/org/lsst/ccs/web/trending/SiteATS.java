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
    }

    static Site create() throws MalformedURLException, JSchException {
        Properties props = new Properties();
        props.setProperty("name", "ats");
        props.setProperty("useSSH", "false");
        props.setProperty("restURL", "http://auxtel-mcm.cp.lsst.org:8080/rest/data/dataserver/");
        
        return new SiteATS(props);
    }
}
