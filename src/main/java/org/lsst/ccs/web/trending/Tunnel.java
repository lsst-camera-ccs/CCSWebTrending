package org.lsst.ccs.web.trending;

import com.jcraft.jsch.JSchException;
import java.io.IOException;
import java.net.MalformedURLException;

/**
 *
 * @author tonyj
 */
public class Tunnel {

    public static void main(String[] args) throws JSchException, MalformedURLException, IOException {
        try (Site site = SiteATS.create()) {
            ChannelTree channelTree = site.getChannelTree();
            System.out.println(channelTree);
        }
    }
}
