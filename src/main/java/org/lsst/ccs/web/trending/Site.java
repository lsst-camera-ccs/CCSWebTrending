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
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
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
    private final AtomicReference<ChannelTree> channelTree = new AtomicReference<>();
    private final AtomicBoolean channelTreeInitialized = new AtomicBoolean(false);
    private final CountDownLatch channelTreeInitCompleteLatch = new CountDownLatch(1);
    private final AtomicReference<ChannelTree> fullChannelTree = new AtomicReference<>();
    private final AtomicBoolean fullChannelTreeInitialized = new AtomicBoolean(false);
    private final CountDownLatch fullChannelTreeInitCompleteLatch = new CountDownLatch(1);
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
    private static final Logger LOG = Logger.getLogger(Site.class.getName());
    private static final int SSH_TIMEOUT = 10000;
    private static final int SSH_RETRIES = 2;
    private int sshTimeout = SSH_TIMEOUT;
    private int sshRetries = SSH_RETRIES;

    private final Set<String> allSources = new LinkedHashSet<>();
    
    private Map<String,SessionWrapper> sessionsMap = new LinkedHashMap<>();
    
    private final String defaultSource;
    
    

    public Site(Properties properties) throws MalformedURLException, JSchException {
        this.name = properties.getProperty("name");
        
        defaultSource = properties.getProperty("defaultSource", "");
        allSources.add(defaultSource);
        
        for ( Object prop : properties.keySet() ) {
            String propStr = (String)prop;
            if ( propStr.endsWith("restURL") ) {
                String sourceName = propStr.replace("restURL", "");
                if ( sessionsMap.containsKey(sourceName) ) {
                    throw new RuntimeException("Source "+sourceName+" is already defined for site "+name);                    
                }
                
                allSources.add(sourceName);
                URL url = new URL(properties.getProperty(propStr));
                boolean useSSH = Boolean.parseBoolean(properties.getProperty(sourceName+"useSSH", "false"));
                SessionWrapper sw = new SessionWrapper(name, sourceName, url, useSSH, properties);
                sessionsMap.put(sourceName, sw);
            }
        }
    }
    
    
    private static class SessionWrapper {
        private final String sshUsername;
        private final String sshHost;
        private final File sshKey;
        private final String sshKeyPassword;
        private final boolean useSSH;
        private volatile Session session;
        private volatile URL restURL = null;
        private volatile URL tunnelURL;
        private final String siteName;

        SessionWrapper(String siteName, String sourceName, URL url, boolean useSSH, Properties properties) {
            this.useSSH = useSSH;
            this.restURL = url;
            this.siteName = siteName;
            
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
                    LOG.log(Level.INFO, "Tunnel to {0} for site {1} opened {2}", new Object[]{sshHost, siteName, tunnelURL});
                } catch (JSchException ex) {
                    throw new IOException("Error opening tunnel ", ex);
                }
            }
        }

        public Session getSession() {
            return session;
        }

        public URL getTunnelURL() {
            return tunnelURL;
        }
        
        public boolean getUseSSH() {
            return useSSH;
        }
        
        public URL getRestURL() {
            return restURL;
        }
        
    }
    
    public Set<String> getAvailableSources() {
        return allSources;
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


    public InputStream openURL(String relativePath, String source) throws MalformedURLException, IOException {
        String sourceToUse = source == null ? defaultSource : source;
        SessionWrapper sessionWrapper = sessionsMap.get(sourceToUse);
        
        if (!sessionWrapper.getUseSSH()) {
            URL url = new URL(sessionWrapper.getRestURL(), relativePath);
            return url.openStream();
        } else {
            IOException cause = null;
            for (int i=0;i<sshRetries;i++) {
                sessionWrapper.establishConnection();
                URL url = new URL(sessionWrapper.getTunnelURL(), relativePath);
                try {
                    URLConnection connection = url.openConnection();
                    connection.setConnectTimeout(sshTimeout);
                    connection.setReadTimeout(sshTimeout);
                    return connection.getInputStream();
                } catch (IOException x) {
                    cause = x;
                    LOG.log(Level.WARNING, "Failed to connect via ssh to "+url+" (attempt "+i+")", x);
                    sessionWrapper.getSession().disconnect();
                }
            }
            throw new IOException("Unable to establish ssh connection after "+sshRetries+" retries", cause);
        }
    }

    @Override
    public void close() {
        for ( SessionWrapper sw : sessionsMap.values() ) {
            if (sw.getUseSSH() ) {
                Session session = sw.getSession();
                if ( session != null && session.isConnected() ) {
                    session.disconnect();
                }
            }
        }
    }

    ChannelTree getChannelTree(boolean refresh) throws IOException {
        Runnable readChannelTree = new Runnable() {
            @Override
            public void run() {
                try (InputStream in = openURL("listchannels?maxIdleSeconds=604800", null)) {
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
    
    ChannelTree getFullChannelTree(boolean refresh) throws IOException {
        Runnable readFullChannelTree = new Runnable() {
            @Override
            public void run() {
                try (InputStream in = openURL("listchannels?maxIdleSeconds=0", null)) {
                    fullChannelTree.set(new ChannelTree(in));
                    LOG.log(Level.INFO, "Read full channel tree for site {0}", name);                
                    scheduler.schedule(this, 12, TimeUnit.HOURS);
                } catch (IOException x) {
                    LOG.log(Level.WARNING, "Error reading full channel tree for site "+name, x);                
                    scheduler.schedule(this, 5, TimeUnit.MINUTES);
                } 
            }
        };

        if (refresh || !fullChannelTreeInitialized.getAndSet(true)) {
            try {
                readFullChannelTree.run();
            } finally {
                fullChannelTreeInitCompleteLatch.countDown();
            }
        } else {
            try {
                fullChannelTreeInitCompleteLatch.await();
            } catch (InterruptedException x) {
                throw new InterruptedIOException();
            }
        }
        ChannelTree result = fullChannelTree.get();
        if (result == null) {
            throw new IOException("Full channel tree unavailable");
        }
        return result;
    }

    String getName() {
        return name;
    }    
}
