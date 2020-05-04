package org.lsst.ccs.web.trending;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.BiConsumer;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import javax.xml.xpath.XPath;
import javax.xml.xpath.XPathConstants;
import javax.xml.xpath.XPathExpression;
import javax.xml.xpath.XPathExpressionException;
import javax.xml.xpath.XPathFactory;
import org.w3c.dom.Document;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.SAXException;

/**
 *
 * @author tonyj
 */
public class ChannelTree {

    private final TreeNode root;
    private int nextHandle = 0;
    private final Map<Integer, TreeNode> nodeMap = new HashMap<>();

    private ChannelTree() {
        root = new TreeNode(nextHandle++);
        nodeMap.put(root.getHandle(), root);
    }

    ChannelTree(String message) {
        root = new TreeNode(nextHandle++);
        root.addChild(new TreeNode(nextHandle++, message));
    }

    ChannelTree(InputStream in) throws IOException {
        this();
        buildTree(in);
    }

    private void buildTree(InputStream in) throws IOException {
        DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
        try {
            DocumentBuilder db = dbf.newDocumentBuilder();
            Document doc = db.parse(in);

            XPathFactory xPathfactory = XPathFactory.newInstance();
            XPath xpath = xPathfactory.newXPath();
            XPathExpression expr = xpath.compile("datachannels/datachannel");
            XPathExpression pathExpression = xpath.compile("path/pathelement");
            NodeList nl = (NodeList) expr.evaluate(doc, XPathConstants.NODESET);
            for (int n = 0; n < nl.getLength(); n++) {
                Node node = nl.item(n);
                // The next line gives a huge performaance increase. 
                // See: https://stackoverflow.com/questions/3782618
                node.getParentNode().removeChild(node);
                NodeList pathList = (NodeList) pathExpression.evaluate(node, XPathConstants.NODESET);
                List<String> path = new ArrayList<>(pathList.getLength());
                for (int nn = 0; nn < pathList.getLength(); nn++) {
                    path.add(pathList.item(nn).getTextContent());
                }
                String id = (String) xpath.evaluate("id", node, XPathConstants.STRING);
                addNode(id, path);
            }
        } catch (SAXException | XPathExpressionException | ParserConfigurationException x) {
            throw new IOException("Error parsing channel list", x);
        }
    }

    private void addNode(String id, List<String> path) {
        TreeNode node = root;
        for (String element : path) {
            TreeNode child = node.findChildByName(element);
            if (child == null) {
                child = new TreeNode(nextHandle++, element);
                node.addChild(child);
                nodeMap.put(child.getHandle(), child);
            }
            node = child;
        }
        node.setId(id);
    }

    TreeNode getRoot() {
        return root;
    }

    TreeNode findNode(Integer handle) {
        return nodeMap.get(handle);
    }

    private void traverseTree(TreeNode start, List<String> initialPath, boolean visitAll, BiConsumer<List<String>, TreeNode> visitor) {
        final Set<TreeNode> children = start.getChildren();
        List<String> path = new ArrayList(initialPath);
        if (start.getName() != null) {
            path.add(start.getName());
        }
        if (children.isEmpty()) {
            visitor.accept(path, start);
        } else {
            if (visitAll) {
                visitor.accept(path, start);
            }
            children.forEach((child) -> {
                traverseTree(child, path, visitAll, visitor);
            });
        }
    }

    ChannelTree filter(Pattern pattern) {
        ChannelTree result = new ChannelTree();
        traverseTree(root, Collections.EMPTY_LIST, false, (path, node) -> {
            String fullPath = path.stream().collect(Collectors.joining("/"));
            if (pattern.matcher(fullPath).matches()) {
                result.addNode(node.getId(), path);
            }
        });
        return result;
    }

    /**
     * Nodes which contain only a single child have the child incorporated into
     * the parent
     *
     * @return The flattened tree.
     */
    ChannelTree flatten() {
        ChannelTree result = new ChannelTree();
        final List<Integer> suppressStart = new ArrayList<>();
        final List<Integer> suppressSize = new ArrayList<>();
        traverseTree(root, Collections.EMPTY_LIST, true, (path, node) -> {
            if (path.size() == 0) return;
            for (int index = suppressStart.size()-1; index>=0; index--) {
                if (path.size() <= suppressStart.get(index)+suppressSize.get(index)) {
                    suppressStart.remove(index);
                    suppressSize.remove(index);
                }
            }
            if (node.getChildren().size() == 1) {
                int index = suppressStart.size() - 1;
                if (index >= 0 && suppressStart.get(index) + suppressSize.get(index) + 1 == path.size()) {
                    suppressSize.set(index, suppressSize.get(index) + 1);
                } else {
                    suppressStart.add(path.size() - 1);
                    suppressSize.add(1);
                }
            } 
            else if (node.getChildren().isEmpty()) {
                if (suppressStart.isEmpty()) {
                    result.addNode(node.getId(), path);
                } else {
                    List<String> newPath = new ArrayList<>();
                    int index = 0;
                    for (int i=0; i<path.size() ;) {
                        if (index < suppressStart.size() && i == suppressStart.get(index)) {
                            newPath.add(String.join("/", path.subList(i, i + suppressSize.get(index)+1)));
                            i += suppressSize.get(index) + 1;
                            index++;
                        } else {
                            newPath.add(path.get(i));
                            i++;
                        }
                    }
                    result.addNode(node.getId(), newPath);
                }
            }
        });
        return result;
    }

    void dump() {
        traverseTree(root, Collections.EMPTY_LIST, false, (path, node) -> System.out.printf("%s: %s\n", path, node.id));
    }

    public static class TreeNode implements Comparable<TreeNode> {

        private final String name;
        private Set<TreeNode> children;
        private final int handle;
        private String id;

        private TreeNode(int handle) {
            this.name = null;
            this.handle = handle;
        }

        private TreeNode(int handle, String name) {
            this.name = name;
            this.handle = handle;
        }

        private void addChild(TreeNode child) {
            if (children == null) {
                children = new TreeSet<>();
            }
            children.add(child);
        }

        private TreeNode findChildByName(String name) {
            if (children != null) {
                for (TreeNode child : children) {
                    if (name.equals(child.name)) {
                        return child;
                    }
                }
            }
            return null;
        }

        private void setId(String id) {
            this.id = id;
        }

        @Override
        public String toString() {
            return "TreeNode{" + "name=" + name + ", children=" + children + ", handle=" + handle + ", id=" + id + '}';
        }

        public String getName() {
            return name;
        }

        public Set<TreeNode> getChildren() {
            return children == null ? Collections.EMPTY_SET : children;
        }

        public String getId() {
            return id;
        }

        public int getHandle() {
            return handle;
        }

        @Override
        public int compareTo(TreeNode other) {
            return this.name.compareTo(other.name);
        }

    }
}
