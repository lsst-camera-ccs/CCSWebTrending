package org.lsst.ccs.web.trending;

import com.jcraft.jsch.JSchException;
import java.net.MalformedURLException;
import java.util.Properties;

/**
 *
 * @author tonyj
 */
public class SiteMainCamera extends Site {
    private SiteMainCamera(Properties props) throws MalformedURLException, JSchException {
        super(props);
    }

    static Site create() throws MalformedURLException, JSchException {
        Properties props = new Properties();
        props.setProperty("name", "maincamera");
        props.setProperty("useSSH", "false");
        props.setProperty("CCSrestURL", "http://lsstcam-mcm.cp.lsst.org:8080/rest/data/dataserver/");
        props.setProperty("EFDrestURL", "http://lsstcam-mcm.cp.lsst.org:8080/efd-rest/data/dataserver/");
        props.setProperty("defaultSource", "CCS");

        return new SiteMainCamera(props);
    }    
}
