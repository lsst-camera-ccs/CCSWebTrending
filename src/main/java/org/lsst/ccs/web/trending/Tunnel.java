package org.lsst.ccs.web.trending;

import com.jcraft.jsch.JSch;
import com.jcraft.jsch.JSchException;
import com.jcraft.jsch.Session;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.MalformedURLException;
import java.net.URL;
import java.util.Properties;
import java.util.stream.Stream;

/**
 *
 * @author tonyj
 */
public class Tunnel {

    public static void main(String[] args) throws JSchException, MalformedURLException, IOException {
        JSch jsch = new JSch();
        jsch.addIdentity("/home/tonyj/.ssh/id_rsa");
        Session session = jsch.getSession("tonyj", "lsst-it01.slac.stanford.edu");
        Properties config = new Properties();
        config.put("StrictHostKeyChecking", "no");
        config.put("PreferredAuthentications", "publickey");
        session.setConfig(config);
        //session.setDaemonThread(true);
        session.connect();
        int port = session.setPortForwardingL(null, 0, "lsst-mcm.slac.stanford.edu", 8080);
        URL restURL = new URL("http", "localhost", port, "/rest/data/dataserver/listchannels");
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(restURL.openStream()))) {
            Stream<String> stream = reader.lines();
            stream.forEach(System.out::println);
        }
        session.disconnect();
    }
}
