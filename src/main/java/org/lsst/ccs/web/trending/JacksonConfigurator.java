package org.lsst.ccs.web.trending;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.module.SimpleModule;
import java.io.IOException;
import java.util.Map;
import javax.ws.rs.Produces;
import javax.ws.rs.ext.ContextResolver;
import javax.ws.rs.ext.Provider;
import org.lsst.ccs.web.trending.ChannelTree.TreeNode;
import org.lsst.ccs.web.trending.MergedMap.Bin;
import org.lsst.ccs.web.trending.TrendingRestInterface.ErrorBars;

/**
 * Register custom jackson serializers.
 *
 * @author tonyj
 */
@Provider
@Produces("application/json")
public class JacksonConfigurator implements ContextResolver<ObjectMapper> {

    private final ObjectMapper mapper = new ObjectMapper();

    public JacksonConfigurator() {
        SimpleModule module = new SimpleModule();
        module.addSerializer(MergedMap.class, new MergedMapSerializer());
        module.addSerializer(TreeNode.class, new TreeNodeSerializer());
        mapper.registerModule(module);
    }

    @Override
    public ObjectMapper getContext(Class<?> type) {
        return mapper;
    }

    private static class MergedMapSerializer extends JsonSerializer<MergedMap> {

        @Override
        public void serialize(MergedMap mergedMap, JsonGenerator jgen, SerializerProvider provider) throws IOException, JsonProcessingException {
            Map<Long, Bin[]> map = mergedMap.getMap();
            jgen.writeStartArray();
            for (Map.Entry<Long, Bin[]> entry : map.entrySet()) {
                jgen.writeStartArray();
                jgen.writeNumber(entry.getKey());
                for (Bin a : entry.getValue()) {
                    if (a == null) {
                        jgen.writeNull();
                    } else if (mergedMap.getErrorBars() == ErrorBars.NONE) {
                        jgen.writeNumber(a.getValue());
                    } else {
                        jgen.writeStartArray();
                        if (mergedMap.getErrorBars() == ErrorBars.MINMAX) {
                            jgen.writeNumber(a.getMin());
                            jgen.writeNumber(a.getValue());
                            jgen.writeNumber(a.getMax());
                        } else {
                            jgen.writeNumber(a.getValue());
                            jgen.writeNumber(a.getRMS());
                        }
                        jgen.writeEndArray();
                    }
                }
                jgen.writeEndArray();
            }
            jgen.writeEndArray();
        }
    }

    private static class TreeNodeSerializer extends JsonSerializer<TreeNode> {

        @Override
        public void serialize(TreeNode t, JsonGenerator jg, SerializerProvider sp) throws IOException, JsonProcessingException {
            jg.writeStartObject();
            jg.writeStringField("text", t.getName());
            jg.writeNumberField("id", t.getHandle());
            if (t.getId() != null) {
                jg.writeStringField("data", t.getId());
            }
            jg.writeBooleanField("children", !t.getChildren().isEmpty());
            jg.writeEndObject();
        }
    }
}
