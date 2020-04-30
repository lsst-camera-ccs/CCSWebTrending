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
        tree.dump();
    }

    @Test
    public void filterChannels() throws IOException {
        ChannelTree filtered = tree.filter(Pattern.compile("focal-plane/.*"));
        filtered.dump();
    }
}
