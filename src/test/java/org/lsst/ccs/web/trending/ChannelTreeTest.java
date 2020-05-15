package org.lsst.ccs.web.trending;

import java.io.IOException;
import java.io.InputStream;
import java.util.regex.Pattern;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 *
 * @author tonyj
 */
public class ChannelTreeTest {

    private static ChannelTree tree;

    public ChannelTreeTest() {
    }

    @BeforeAll
    public static void setUpClass() throws Exception {
        try (InputStream in = ChannelTreeTest.class.getResourceAsStream("listchannels.xml")) {
            assertNotNull(in);
            tree = new ChannelTree(in);
            assertEquals(34, tree.getRoot().getChildren().size());
        }
    }

    @AfterAll
    public static void tearDownClass() throws Exception {
    }

    @BeforeEach
    public void setUp() throws Exception {

    }

    @AfterEach
    public void tearDown() throws Exception {
    }

    @Test
    public void testReadChannels() throws IOException {
        assertEquals(34, tree.getRoot().getChildren().size());
        //tree.dump();
    }

    @Test
    public void filterChannels() throws IOException {
        ChannelTree filtered = tree.filter(Pattern.compile("focal-plane/.*"));
        assertEquals(1, filtered.getRoot().getChildren().size());
        //filtered.dump();
    }
    
    @Test 
    public void flattenChannels() throws IOException {
        ChannelTree filtered = tree.filter(Pattern.compile(".*/freememory",Pattern.CASE_INSENSITIVE));
        ChannelTree flattened = filtered.flatten();
        assertEquals(34,flattened.getRoot().getChildren().size());
        //flattened.dump();
    }
    
    @Test 
    public void flattenChannels2() throws IOException {
        ChannelTree filtered = tree.filter(Pattern.compile(".*/*memory",Pattern.CASE_INSENSITIVE));
        ChannelTree flattened = filtered.flatten();
        assertEquals(34,flattened.getRoot().getChildren().size());
    }

    @Test 
    public void flattenChannels3() throws IOException {
        ChannelTree filtered = tree.filter(Pattern.compile(".*/R34/.*/rds/.*",Pattern.CASE_INSENSITIVE));
        ChannelTree flattened = filtered.flatten();
        assertEquals(1,flattened.getRoot().getChildren().size());
    }

    @Test 
    public void flattenChannels4() throws IOException {
        ChannelTree filtered = tree.filter(Pattern.compile(".*/.*temp",Pattern.CASE_INSENSITIVE));
        ChannelTree flattened = filtered.flatten();
        assertEquals(5,flattened.getRoot().getChildren().size());
    }
}
