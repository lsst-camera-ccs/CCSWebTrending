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

/**
 * Register custom jackson serializers for Waveform histories.
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
            Map<Long, Double[]> map = mergedMap.getMap();
            jgen.writeStartArray();
            for (Map.Entry<Long, Double[]> entry : map.entrySet()) {
                jgen.writeStartArray();
                jgen.writeNumber(entry.getKey());
                for (Double a : entry.getValue()) {
                    if (a == null) {
                        jgen.writeNull();
                    } else {
                        jgen.writeNumber(a);
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
            jg.writeNumberField("id",t.getHandle());
            if (t.getId() != null) {
                jg.writeStringField("extra", t.getId());
            }
            jg.writeBooleanField("children", !t.getChildren().isEmpty());
            jg.writeEndObject();
        }
    }
}
