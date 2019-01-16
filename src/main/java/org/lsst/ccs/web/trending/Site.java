package org.lsst.ccs.web.trending;

import com.jcraft.jsch.JSch;
import com.jcraft.jsch.JSchException;
import com.jcraft.jsch.Session;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.net.MalformedURLException;
import java.net.URL;
import java.util.Properties;

/**
 *
 * @author tonyj
 */
public class Site implements AutoCloseable {

    private final String name;
    private final boolean useSSH;
    private final URL restURL;
    private String sshUsername;
    private String sshHost;
    private File sshKey;
    private String sshKeyPassword;
    private Session session;
    private URL tunnelURL;
    private ChannelTree channelTree;

    public Site(Properties properties) throws MalformedURLException, JSchException {
        this.name = properties.getProperty("name");
        this.useSSH = Boolean.valueOf(properties.getProperty("useSSH", "false"));
        this.restURL = new URL(properties.getProperty("restURL"));
        if (useSSH) {
            this.sshUsername = properties.getProperty("ssh.user");
            this.sshHost = properties.getProperty("ssh.host");
            this.sshKey = new File(properties.getProperty("ssh.key"));
            if (!sshKey.canRead()) {
                throw new RuntimeException("Invalid ssh key " + properties.getProperty("ssh.key"));
            }
            this.sshKeyPassword = properties.getProperty("ssh.key.password");
        }
    }

    private void establishConnection() throws MalformedURLException, IOException {
        if (useSSH && (session == null || !session.isConnected())) {
            try {
                JSch jsch = new JSch();
                jsch.addIdentity(sshKey.getAbsolutePath(), sshKeyPassword);
                session = jsch.getSession(sshUsername, sshHost);
                Properties config = new Properties();
                config.put("StrictHostKeyChecking", "no");
                config.put("PreferredAuthentications", "publickey");
                session.setConfig(config);
                session.setDaemonThread(true);
                session.connect(5000);
                int port = session.setPortForwardingL(null, 0, restURL.getHost(), restURL.getPort());
                tunnelURL = new URL("http", "localhost", port, restURL.getPath());
            } catch (JSchException ex) {
                throw new IOException("Error opening tunnel ", ex);
            }
        }
    }

    public InputStream openURL(String relativePath) throws MalformedURLException, IOException {
        if (!useSSH) {
            URL url = new URL(restURL, relativePath);
            return url.openStream();
        } else {
            establishConnection();
            URL url = new URL(tunnelURL, relativePath);
            return url.openStream();
        }
    }

    @Override
    public void close() {
        if (useSSH && session.isConnected()) {
            session.disconnect();
        }
    }

    ChannelTree getChannelTree() throws IOException {
        if (channelTree == null) {
            try (InputStream in = openURL("listchannels?maxIdleSeconds=604800")) {
                channelTree = new ChannelTree(in);
            }
        }
        return channelTree;
    }

    String getName() {
        return name;
    }
}
