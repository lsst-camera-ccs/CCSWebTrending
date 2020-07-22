package org.lsst.ccs.web.trending;

import com.jcraft.jsch.JSch;
import com.jcraft.jsch.JSchException;
import com.jcraft.jsch.Session;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.InterruptedIOException;
import java.net.MalformedURLException;
import java.net.URL;
import java.net.URLConnection;
import java.util.Properties;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 *
 * @author tonyj
 */
public class Site implements AutoCloseable {

    private final String name;
    private final boolean useSSH;
    private final URL restURL;
    private final String sshUsername;
    private final String sshHost;
    private final File sshKey;
    private final String sshKeyPassword;
    private volatile Session session;
    private volatile URL tunnelURL;
    private final AtomicReference<ChannelTree> channelTree = new AtomicReference<>();
    private final AtomicBoolean channelTreeInitialized = new AtomicBoolean(false);
    private final CountDownLatch channelTreeInitCompleteLatch = new CountDownLatch(1);
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
    private static final Logger LOG = Logger.getLogger(Site.class.getName());
    private static final int SSH_TIMEOUT = 10000;
    private static final int SSH_RETRIES = 2;
    private int sshTimeout = SSH_TIMEOUT;
    private int sshRetries = SSH_RETRIES;

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
        } else {
            sshUsername = sshHost = sshKeyPassword = null;
            sshKey = null;
        }
    }

    public Session getSession() {
        return session;
    }

    public void setSession(Session session) {
        this.session = session;
    }

    public URL getTunnelURL() {
        return tunnelURL;
    }

    public void setTunnelURL(URL tunnelURL) {
        this.tunnelURL = tunnelURL;
    }

    public int getSSHTimeout() {
        return sshTimeout;
    }

    public final void setSSHTimeout(int sshTimeout) {
        this.sshTimeout = sshTimeout;
    }

    public int getSSHRetries() {
        return sshRetries;
    }

    public final void setSSHRetries(int sshRetries) {
        this.sshRetries = sshRetries;
    }

    private synchronized void establishConnection() throws MalformedURLException, IOException {
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
                LOG.log(Level.INFO, "Tunnel to {0} for site {1} opened {2}", new Object[]{sshHost, name, tunnelURL});
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
            IOException cause = null;
            for (int i=0;i<sshRetries;i++) {
                establishConnection();
                URL url = new URL(tunnelURL, relativePath);
                try {
                    URLConnection connection = url.openConnection();
                    connection.setConnectTimeout(sshTimeout);
                    connection.setReadTimeout(sshTimeout);
                    return connection.getInputStream();
                } catch (IOException x) {
                    cause = x;
                    LOG.log(Level.WARNING, "Failed to connect via ssh to "+url+" (attempt "+i+")", x);
                    session.disconnect();
                }
            }
            throw new IOException("Unable to establish ssh connection after "+sshRetries+" retries", cause);
        }
    }

    @Override
    public void close() {
        if (useSSH && session != null && session.isConnected()) {
            session.disconnect();
        }
    }

    ChannelTree getChannelTree(boolean refresh) throws IOException {
        Runnable readChannelTree = new Runnable() {
            @Override
            public void run() {
                try (InputStream in = openURL("listchannels?maxIdleSeconds=604800")) {
                    channelTree.set(new ChannelTree(in));
                    LOG.log(Level.INFO, "Read channel tree for site {0}", name);                
                    scheduler.schedule(this, 12, TimeUnit.HOURS);
                } catch (IOException x) {
                    LOG.log(Level.WARNING, "Error reading channel tree for site "+name, x);                
                    scheduler.schedule(this, 5, TimeUnit.MINUTES);
                } 
            }
        };

        if (refresh || !channelTreeInitialized.getAndSet(true)) {
            try {
                readChannelTree.run();
            } finally {
                channelTreeInitCompleteLatch.countDown();
            }
        } else {
            try {
                channelTreeInitCompleteLatch.await();
            } catch (InterruptedException x) {
                throw new InterruptedIOException();
            }
        }
        ChannelTree result = channelTree.get();
        if (result == null) {
            throw new IOException("Channel tree unavailable");
        }
        return result;
    }

    String getName() {
        return name;
    }
}
