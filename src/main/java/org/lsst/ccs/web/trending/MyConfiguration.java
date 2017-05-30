package org.lsst.ccs.web.trending;

import javax.ws.rs.ApplicationPath;
import org.glassfish.jersey.jackson.JacksonFeature;
import org.glassfish.jersey.server.ResourceConfig;

/**
 *
 * @author tonyj
 */
@ApplicationPath("/rest")
public class MyConfiguration extends ResourceConfig {

    public MyConfiguration() {
        register(TrendingRestInterface.class);
        register(JacksonFeature.class);
        register(JacksonConfigurator.class);
    }
}
