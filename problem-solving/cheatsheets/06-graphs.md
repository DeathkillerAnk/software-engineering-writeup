# 06 · Graphs

Graph traversal, ordering, connectivity, and shortest-path patterns with reusable Java templates.

---

## Core building blocks

### Adjacency list building
**Category:** 🧩 Template

```java
import java.util.*;

// From edge list. n = number of nodes labeled 0..n-1.
List<List<Integer>> buildGraph(int n, int[][] edges, boolean directed) {
    List<List<Integer>> adj = new ArrayList<>();
    for (int i = 0; i < n; i++) adj.add(new ArrayList<>());
    for (int[] e : edges) {
        adj.get(e[0]).add(e[1]);
        if (!directed) adj.get(e[1]).add(e[0]);
    }
    return adj;
}

// Weighted variant: store {neighbor, weight}.
List<List<int[]>> buildWeighted(int n, int[][] edges, boolean directed) {
    List<List<int[]>> adj = new ArrayList<>();
    for (int i = 0; i < n; i++) adj.add(new ArrayList<>());
    for (int[] e : edges) {
        adj.get(e[0]).add(new int[]{e[1], e[2]});
        if (!directed) adj.get(e[1]).add(new int[]{e[0], e[2]});
    }
    return adj;
}
```

### Generic BFS template
**Category:** 🧩 Template

```java
// Level-order traversal from a single source. Returns shortest #edges to each node.
int[] bfs(List<List<Integer>> adj, int start) {
    int n = adj.size();
    int[] dist = new int[n];
    Arrays.fill(dist, -1);
    Queue<Integer> q = new ArrayDeque<>();
    q.offer(start);
    dist[start] = 0;
    while (!q.isEmpty()) {
        int node = q.poll();
        for (int next : adj.get(node)) {
            if (dist[next] == -1) {          // unvisited
                dist[next] = dist[node] + 1;
                q.offer(next);
            }
        }
    }
    return dist;
}
```

### Generic DFS template
**Category:** 🧩 Template

```java
// Recursive DFS marking visited.
void dfs(List<List<Integer>> adj, int node, boolean[] visited) {
    visited[node] = true;
    for (int next : adj.get(node)) {
        if (!visited[next]) dfs(adj, next, visited);
    }
}

// Iterative DFS (avoids stack overflow on deep graphs).
void dfsIterative(List<List<Integer>> adj, int start, boolean[] visited) {
    Deque<Integer> stack = new ArrayDeque<>();
    stack.push(start);
    while (!stack.isEmpty()) {
        int node = stack.pop();
        if (visited[node]) continue;
        visited[node] = true;
        for (int next : adj.get(node)) {
            if (!visited[next]) stack.push(next);
        }
    }
}
```

### Union-Find (DSU) — path compression + union by rank
**Category:** 🧩 Template

```java
class DSU {
    int[] parent, rank;
    int count;                 // number of disjoint components

    DSU(int n) {
        parent = new int[n];
        rank = new int[n];
        count = n;
        for (int i = 0; i < n; i++) parent[i] = i;
    }

    int find(int x) {                       // with path compression
        while (parent[x] != x) {
            parent[x] = parent[parent[x]];   // halving
            x = parent[x];
        }
        return x;
    }

    boolean union(int a, int b) {            // by rank; returns false if already joined
        int ra = find(a), rb = find(b);
        if (ra == rb) return false;
        if (rank[ra] < rank[rb]) { int t = ra; ra = rb; rb = t; }
        parent[rb] = ra;
        if (rank[ra] == rank[rb]) rank[ra]++;
        count--;
        return true;
    }

    boolean connected(int a, int b) { return find(a) == find(b); }
}
```

> Near-constant amortized time per op: O(α(n)), where α is the inverse Ackermann function.

---

## Grid / Graph Traversal

### Number of Islands
**Category:** ⭐ Tier 1 · Core
**Pattern:** Grid DFS/BFS connected components.  **Time:** O(m·n)  **Space:** O(m·n) worst-case recursion.
**Approach:** Scan every cell; when an unvisited land cell ('1') is found, increment the count and flood the entire island by DFS, marking visited cells (overwrite to '0' in place) so they are not recounted. Each cell is visited at most once.

```java
public int numIslands(char[][] grid) {
    int m = grid.length, n = grid[0].length, count = 0;
    for (int i = 0; i < m; i++)
        for (int j = 0; j < n; j++)
            if (grid[i][j] == '1') { count++; sink(grid, i, j); }
    return count;
}

private void sink(char[][] g, int i, int j) {
    if (i < 0 || i >= g.length || j < 0 || j >= g[0].length || g[i][j] != '1') return;
    g[i][j] = '0';
    sink(g, i + 1, j); sink(g, i - 1, j);
    sink(g, i, j + 1); sink(g, i, j - 1);
}
```
**Alternative:** BFS with a queue if recursion depth is a concern; or a DSU over land cells.

### Flood Fill
**Category:** Tier 3 · Reference
**Pattern:** Grid DFS from a source.  **Time:** O(m·n)  **Space:** O(m·n).
**Approach:** Starting at (sr, sc), recolor all 4-directionally connected cells sharing the original color. Capture the start color first and stop early if it already equals the target (otherwise infinite recursion).

```java
public int[][] floodFill(int[][] image, int sr, int sc, int color) {
    int start = image[sr][sc];
    if (start != color) fill(image, sr, sc, start, color);
    return image;
}

private void fill(int[][] img, int i, int j, int from, int to) {
    if (i < 0 || i >= img.length || j < 0 || j >= img[0].length || img[i][j] != from) return;
    img[i][j] = to;
    fill(img, i + 1, j, from, to); fill(img, i - 1, j, from, to);
    fill(img, i, j + 1, from, to); fill(img, i, j - 1, from, to);
}
```

### Clone Graph
**Category:** Tier 2 · Reinforce
**Pattern:** DFS/BFS with a visited map (old → new).  **Time:** O(V + E)  **Space:** O(V).
**Approach:** Traverse the graph; for each original node create its clone once and store it in a map. When visiting neighbors, look up (or create) clones and wire them into the cloned node's neighbor list. The map both deduplicates and breaks cycles.

```java
class Node {
    public int val;
    public List<Node> neighbors;
    public Node(int v) { val = v; neighbors = new ArrayList<>(); }
}

public Node cloneGraph(Node node) {
    if (node == null) return null;
    Map<Node, Node> seen = new HashMap<>();
    return dfs(node, seen);
}

private Node dfs(Node node, Map<Node, Node> seen) {
    if (seen.containsKey(node)) return seen.get(node);
    Node copy = new Node(node.val);
    seen.put(node, copy);
    for (Node nb : node.neighbors) copy.neighbors.add(dfs(nb, seen));
    return copy;
}
```

### Number of Connected Components (in an Undirected Graph)
**Category:** Tier 3 · Reference
**Pattern:** Union-Find (or DFS).  **Time:** O(V + E·α)  **Space:** O(V).
**Approach:** Start with n components. Union the endpoints of each edge; every successful union (joining two previously separate sets) reduces the component count by one. The DSU's `count` field is the answer.

```java
public int countComponents(int n, int[][] edges) {
    DSU dsu = new DSU(n);
    for (int[] e : edges) dsu.union(e[0], e[1]);
    return dsu.count;
}
```
**Alternative:** DFS from each unvisited node, counting how many DFS launches occur.

### Surrounded Regions
**Category:** Tier 3 · Reference
**Pattern:** Reverse flood — mark border-connected regions first.  **Time:** O(m·n)  **Space:** O(m·n).
**Approach:** A region of 'O' survives only if it touches the border. DFS from every border 'O', temporarily marking connected 'O's as safe ('#'). After that, flip all remaining 'O' (truly surrounded) to 'X' and restore the safe '#' back to 'O'.

```java
public void solve(char[][] board) {
    int m = board.length, n = board[0].length;
    for (int i = 0; i < m; i++) { guard(board, i, 0); guard(board, i, n - 1); }
    for (int j = 0; j < n; j++) { guard(board, 0, j); guard(board, m - 1, j); }
    for (int i = 0; i < m; i++)
        for (int j = 0; j < n; j++)
            board[i][j] = board[i][j] == '#' ? 'O' : 'X';
}

private void guard(char[][] b, int i, int j) {
    if (i < 0 || i >= b.length || j < 0 || j >= b[0].length || b[i][j] != 'O') return;
    b[i][j] = '#';
    guard(b, i + 1, j); guard(b, i - 1, j);
    guard(b, i, j + 1); guard(b, i, j - 1);
}
```

### Pacific Atlantic Water Flow
**Category:** Tier 2 · Reinforce
**Pattern:** Multi-source DFS from both oceans.  **Time:** O(m·n)  **Space:** O(m·n).
**Approach:** Instead of testing each cell, flow water backward from the ocean borders uphill (to neighbors with height ≥ current). Cells reachable from the Pacific border form one set, from the Atlantic border another; the answer is their intersection.

```java
public List<List<Integer>> pacificAtlantic(int[][] h) {
    int m = h.length, n = h[0].length;
    boolean[][] pac = new boolean[m][n], atl = new boolean[m][n];
    for (int i = 0; i < m; i++) { flow(h, i, 0, pac); flow(h, i, n - 1, atl); }
    for (int j = 0; j < n; j++) { flow(h, 0, j, pac); flow(h, m - 1, j, atl); }
    List<List<Integer>> res = new ArrayList<>();
    for (int i = 0; i < m; i++)
        for (int j = 0; j < n; j++)
            if (pac[i][j] && atl[i][j]) res.add(List.of(i, j));
    return res;
}

private void flow(int[][] h, int i, int j, boolean[][] seen) {
    seen[i][j] = true;
    int[][] dirs = {{1,0},{-1,0},{0,1},{0,-1}};
    for (int[] d : dirs) {
        int ni = i + d[0], nj = j + d[1];
        if (ni >= 0 && ni < h.length && nj >= 0 && nj < h[0].length
                && !seen[ni][nj] && h[ni][nj] >= h[i][j])
            flow(h, ni, nj, seen);
    }
}
```

### Max Area of Island
**Category:** Tier 3 · Reference
**Pattern:** Grid DFS returning subtree size.  **Time:** O(m·n)  **Space:** O(m·n).
**Approach:** Same island flooding as Number of Islands, but each DFS returns the count of cells it sank; track the maximum across all islands. Sinking visited land prevents double counting.

```java
public int maxAreaOfIsland(int[][] grid) {
    int best = 0;
    for (int i = 0; i < grid.length; i++)
        for (int j = 0; j < grid[0].length; j++)
            if (grid[i][j] == 1) best = Math.max(best, area(grid, i, j));
    return best;
}

private int area(int[][] g, int i, int j) {
    if (i < 0 || i >= g.length || j < 0 || j >= g[0].length || g[i][j] != 1) return 0;
    g[i][j] = 0;
    return 1 + area(g, i + 1, j) + area(g, i - 1, j) + area(g, i, j + 1) + area(g, i, j - 1);
}
```

---

## BFS Shortest Path (unweighted)

### Rotting Oranges
**Category:** ⭐ Tier 1 · Core
**Pattern:** Multi-source BFS over a grid.  **Time:** O(m·n)  **Space:** O(m·n).
**Approach:** Seed the queue with all initially rotten oranges (time 0) and count fresh oranges. BFS level by level; each level is one minute, and rotting a fresh neighbor decrements the fresh count. Return the last minute, or -1 if any fresh orange remains.

```java
public int orangesRotting(int[][] grid) {
    int m = grid.length, n = grid[0].length, fresh = 0, minutes = 0;
    Queue<int[]> q = new ArrayDeque<>();
    for (int i = 0; i < m; i++)
        for (int j = 0; j < n; j++) {
            if (grid[i][j] == 2) q.offer(new int[]{i, j});
            else if (grid[i][j] == 1) fresh++;
        }
    int[][] dirs = {{1,0},{-1,0},{0,1},{0,-1}};
    while (!q.isEmpty() && fresh > 0) {
        minutes++;
        for (int sz = q.size(); sz > 0; sz--) {
            int[] cur = q.poll();
            for (int[] d : dirs) {
                int ni = cur[0] + d[0], nj = cur[1] + d[1];
                if (ni >= 0 && ni < m && nj >= 0 && nj < n && grid[ni][nj] == 1) {
                    grid[ni][nj] = 2; fresh--; q.offer(new int[]{ni, nj});
                }
            }
        }
    }
    return fresh == 0 ? minutes : -1;
}
```

### 01 Matrix
**Category:** Tier 3 · Reference
**Pattern:** Multi-source BFS from all zeros.  **Time:** O(m·n)  **Space:** O(m·n).
**Approach:** The distance of each cell to the nearest 0 is computed by BFS seeded from every 0 simultaneously. Initialize 1-cells to "unvisited" and expand outward; the first time a cell is reached gives its shortest distance.

```java
public int[][] updateMatrix(int[][] mat) {
    int m = mat.length, n = mat[0].length;
    int[][] dist = new int[m][n];
    Queue<int[]> q = new ArrayDeque<>();
    for (int i = 0; i < m; i++)
        for (int j = 0; j < n; j++) {
            if (mat[i][j] == 0) q.offer(new int[]{i, j});
            else dist[i][j] = -1;
        }
    int[][] dirs = {{1,0},{-1,0},{0,1},{0,-1}};
    while (!q.isEmpty()) {
        int[] c = q.poll();
        for (int[] d : dirs) {
            int ni = c[0] + d[0], nj = c[1] + d[1];
            if (ni >= 0 && ni < m && nj >= 0 && nj < n && dist[ni][nj] == -1) {
                dist[ni][nj] = dist[c[0]][c[1]] + 1;
                q.offer(new int[]{ni, nj});
            }
        }
    }
    return dist;
}
```

### Word Ladder
**Category:** Tier 2 · Reinforce
**Pattern:** BFS over implicit word graph.  **Time:** O(N·L·26)  **Space:** O(N·L) (N words, L length).
**Approach:** Words are nodes; an edge connects words differing by one letter. BFS from `beginWord`, generating neighbors by trying all 26 letters at each position and checking membership in the word set. Return the level (number of words in the path) when `endWord` is reached.

```java
public int ladderLength(String beginWord, String endWord, List<String> wordList) {
    Set<String> dict = new HashSet<>(wordList);
    if (!dict.contains(endWord)) return 0;
    Queue<String> q = new ArrayDeque<>();
    q.offer(beginWord);
    int level = 1;
    while (!q.isEmpty()) {
        for (int sz = q.size(); sz > 0; sz--) {
            String w = q.poll();
            if (w.equals(endWord)) return level;
            char[] arr = w.toCharArray();
            for (int i = 0; i < arr.length; i++) {
                char orig = arr[i];
                for (char c = 'a'; c <= 'z'; c++) {
                    arr[i] = c;
                    String next = new String(arr);
                    if (dict.remove(next)) q.offer(next);  // remove = mark visited
                }
                arr[i] = orig;
            }
        }
        level++;
    }
    return 0;
}
```
**Alternative:** Bidirectional BFS from both ends roughly halves the explored frontier.

### Shortest Path in Binary Matrix
**Category:** Tier 3 · Reference
**Pattern:** 8-directional grid BFS.  **Time:** O(n²)  **Space:** O(n²).
**Approach:** Move through 0-cells in 8 directions from top-left to bottom-right. BFS gives the minimum number of cells in the clear path; mark cells visited (set to 1) on enqueue to avoid revisits.

```java
public int shortestPathBinaryMatrix(int[][] grid) {
    int n = grid.length;
    if (grid[0][0] == 1 || grid[n-1][n-1] == 1) return -1;
    int[][] dirs = {{1,0},{-1,0},{0,1},{0,-1},{1,1},{1,-1},{-1,1},{-1,-1}};
    Queue<int[]> q = new ArrayDeque<>();
    q.offer(new int[]{0, 0});
    grid[0][0] = 1;
    int len = 1;
    while (!q.isEmpty()) {
        for (int sz = q.size(); sz > 0; sz--) {
            int[] c = q.poll();
            if (c[0] == n - 1 && c[1] == n - 1) return len;
            for (int[] d : dirs) {
                int ni = c[0] + d[0], nj = c[1] + d[1];
                if (ni >= 0 && ni < n && nj >= 0 && nj < n && grid[ni][nj] == 0) {
                    grid[ni][nj] = 1; q.offer(new int[]{ni, nj});
                }
            }
        }
        len++;
    }
    return -1;
}
```

### Open the Lock
**Category:** Tier 3 · Reference
**Pattern:** BFS over state graph (10000 states).  **Time:** O(10000·8)  **Space:** O(10000).
**Approach:** Each 4-digit combination is a state; neighbors turn one wheel up or down (8 per state). BFS from "0000", skipping deadends and visited states, until reaching the target. The level is the minimum number of turns.

```java
public int openLock(String[] deadends, String target) {
    Set<String> dead = new HashSet<>(Arrays.asList(deadends));
    if (dead.contains("0000")) return -1;
    Set<String> visited = new HashSet<>();
    Queue<String> q = new ArrayDeque<>();
    q.offer("0000"); visited.add("0000");
    int turns = 0;
    while (!q.isEmpty()) {
        for (int sz = q.size(); sz > 0; sz--) {
            String s = q.poll();
            if (s.equals(target)) return turns;
            for (int i = 0; i < 4; i++) {
                for (int delta = -1; delta <= 1; delta += 2) {
                    char[] a = s.toCharArray();
                    a[i] = (char) ('0' + ((a[i] - '0' + delta + 10) % 10));
                    String next = new String(a);
                    if (!dead.contains(next) && visited.add(next)) q.offer(next);
                }
            }
        }
        turns++;
    }
    return -1;
}
```

---

## Topological Sort

### Course Schedule
**Category:** ⭐ Tier 1 · Core
**Pattern:** Cycle detection in a DAG (Kahn's BFS).  **Time:** O(V + E)  **Space:** O(V + E).
**Approach:** Treat prerequisites as directed edges. Repeatedly remove nodes with in-degree 0; if all nodes can be removed, the graph is acyclic and all courses are finishable. A leftover means a cycle.

```java
public boolean canFinish(int numCourses, int[][] prerequisites) {
    List<List<Integer>> adj = new ArrayList<>();
    int[] indeg = new int[numCourses];
    for (int i = 0; i < numCourses; i++) adj.add(new ArrayList<>());
    for (int[] p : prerequisites) { adj.get(p[1]).add(p[0]); indeg[p[0]]++; }
    Queue<Integer> q = new ArrayDeque<>();
    for (int i = 0; i < numCourses; i++) if (indeg[i] == 0) q.offer(i);
    int done = 0;
    while (!q.isEmpty()) {
        int c = q.poll(); done++;
        for (int nx : adj.get(c)) if (--indeg[nx] == 0) q.offer(nx);
    }
    return done == numCourses;
}
```

### Course Schedule II
**Category:** Tier 2 · Reinforce
**Pattern:** Topological order (Kahn's BFS).  **Time:** O(V + E)  **Space:** O(V + E).
**Approach:** Same as Course Schedule but record the order in which zero-in-degree nodes are removed. If the order contains all courses it is a valid topological sequence; otherwise a cycle exists and we return an empty array.

```java
public int[] findOrder(int numCourses, int[][] prerequisites) {
    List<List<Integer>> adj = new ArrayList<>();
    int[] indeg = new int[numCourses];
    for (int i = 0; i < numCourses; i++) adj.add(new ArrayList<>());
    for (int[] p : prerequisites) { adj.get(p[1]).add(p[0]); indeg[p[0]]++; }
    Queue<Integer> q = new ArrayDeque<>();
    for (int i = 0; i < numCourses; i++) if (indeg[i] == 0) q.offer(i);
    int[] order = new int[numCourses];
    int idx = 0;
    while (!q.isEmpty()) {
        int c = q.poll();
        order[idx++] = c;
        for (int nx : adj.get(c)) if (--indeg[nx] == 0) q.offer(nx);
    }
    return idx == numCourses ? order : new int[0];
}
```

### Alien Dictionary
**Category:** Tier 3 · Reference
**Pattern:** Build a precedence graph, then topological sort.  **Time:** O(C) total chars  **Space:** O(1) (≤26 nodes).
**Approach:** Compare each pair of adjacent words; the first differing character gives a directed edge (earlier char → later char). Edge case: if a word is a prefix of a shorter word that precedes it, the ordering is invalid. Then run Kahn's algorithm; a cycle means no valid order exists.

```java
public String alienOrder(String[] words) {
    Map<Character, Set<Character>> adj = new HashMap<>();
    Map<Character, Integer> indeg = new HashMap<>();
    for (String w : words)
        for (char c : w.toCharArray()) { adj.putIfAbsent(c, new HashSet<>()); indeg.putIfAbsent(c, 0); }
    for (int i = 0; i < words.length - 1; i++) {
        String a = words[i], b = words[i + 1];
        int min = Math.min(a.length(), b.length()), j = 0;
        while (j < min && a.charAt(j) == b.charAt(j)) j++;
        if (j == min) { if (a.length() > b.length()) return ""; }   // invalid prefix case
        else if (adj.get(a.charAt(j)).add(b.charAt(j)))
            indeg.merge(b.charAt(j), 1, Integer::sum);
    }
    Queue<Character> q = new ArrayDeque<>();
    for (char c : indeg.keySet()) if (indeg.get(c) == 0) q.offer(c);
    StringBuilder sb = new StringBuilder();
    while (!q.isEmpty()) {
        char c = q.poll();
        sb.append(c);
        for (char nx : adj.get(c)) if (indeg.merge(nx, -1, Integer::sum) == 0) q.offer(nx);
    }
    return sb.length() == indeg.size() ? sb.toString() : "";
}
```
**Alternative (DFS variant):** Post-order DFS pushing finished nodes onto a stack; reverse the stack for the topo order. Use a 3-color (white/gray/black) marking to detect cycles.

```java
// DFS-based topological sort skeleton (0=unvisited, 1=in-stack, 2=done).
boolean dfsTopo(int node, List<List<Integer>> adj, int[] state, Deque<Integer> out) {
    state[node] = 1;
    for (int nx : adj.get(node)) {
        if (state[nx] == 1) return false;                 // back edge => cycle
        if (state[nx] == 0 && !dfsTopo(nx, adj, state, out)) return false;
    }
    state[node] = 2;
    out.push(node);                                       // push on finish
    return true;
}
```

---

## Union-Find Problems

### Number of Provinces
**Category:** ⭐ Tier 1 · Core
**Pattern:** DSU over an adjacency matrix.  **Time:** O(n²·α)  **Space:** O(n).
**Approach:** Cities are nodes; `isConnected[i][j] == 1` is an edge. Union all directly connected city pairs; the number of remaining components is the number of provinces (the DSU `count`).

```java
public int findCircleNum(int[][] isConnected) {
    int n = isConnected.length;
    DSU dsu = new DSU(n);
    for (int i = 0; i < n; i++)
        for (int j = i + 1; j < n; j++)
            if (isConnected[i][j] == 1) dsu.union(i, j);
    return dsu.count;
}
```

### Redundant Connection
**Category:** Tier 2 · Reinforce
**Pattern:** DSU — first edge that closes a cycle.  **Time:** O(n·α)  **Space:** O(n).
**Approach:** Process edges in order, unioning endpoints. The first edge whose endpoints already share a root would create a cycle; in a tree-plus-one-edge graph that edge is exactly the redundant one to remove.

```java
public int[] findRedundantConnection(int[][] edges) {
    DSU dsu = new DSU(edges.length + 1);   // nodes are 1-indexed
    for (int[] e : edges)
        if (!dsu.union(e[0], e[1])) return e;
    return new int[0];
}
```

### Accounts Merge
**Category:** Tier 3 · Reference
**Pattern:** DSU over emails, grouped by owner.  **Time:** O(N·α + sorting)  **Space:** O(N).
**Approach:** Assign each email an id and union all emails within the same account (they belong to one person). Map every email to its account name. Group emails by DSU root, sort each group, and prepend the owner name.

```java
public List<List<String>> accountsMerge(List<List<String>> accounts) {
    Map<String, Integer> id = new HashMap<>();
    Map<String, String> owner = new HashMap<>();
    int n = 0;
    for (List<String> acc : accounts)
        for (int i = 1; i < acc.size(); i++)
            if (!id.containsKey(acc.get(i))) { id.put(acc.get(i), n++); owner.put(acc.get(i), acc.get(0)); }
    DSU dsu = new DSU(n);
    for (List<String> acc : accounts)
        for (int i = 2; i < acc.size(); i++)
            dsu.union(id.get(acc.get(1)), id.get(acc.get(i)));
    Map<Integer, TreeSet<String>> groups = new HashMap<>();
    for (String email : id.keySet())
        groups.computeIfAbsent(dsu.find(id.get(email)), k -> new TreeSet<>()).add(email);
    List<List<String>> res = new ArrayList<>();
    for (TreeSet<String> emails : groups.values()) {
        List<String> row = new ArrayList<>();
        row.add(owner.get(emails.first()));
        row.addAll(emails);
        res.add(row);
    }
    return res;
}
```

### Graph Valid Tree
**Category:** Tier 3 · Reference
**Pattern:** DSU — connectivity + acyclicity.  **Time:** O(n·α)  **Space:** O(n).
**Approach:** A graph on n nodes is a tree iff it has exactly n-1 edges and is fully connected with no cycles. Union each edge; if any edge connects two already-joined nodes there is a cycle (false). Finally confirm a single component.

```java
public boolean validTree(int n, int[][] edges) {
    if (edges.length != n - 1) return false;        // tree needs exactly n-1 edges
    DSU dsu = new DSU(n);
    for (int[] e : edges)
        if (!dsu.union(e[0], e[1])) return false;    // cycle detected
    return dsu.count == 1;
}
```

---

## Weighted Shortest Path

### Network Delay Time (Dijkstra)
**Category:** ⭐ Tier 1 · Core
**Pattern:** Dijkstra with a min-heap.  **Time:** O(E log V)  **Space:** O(V + E).
**Approach:** Find shortest times from source `k` to all nodes, then return the maximum (when the last node receives the signal). Use a priority queue keyed by accumulated time, relaxing edges and skipping stale entries; if any node is unreachable, return -1.

```java
public int networkDelayTime(int[][] times, int n, int k) {
    List<List<int[]>> adj = new ArrayList<>();
    for (int i = 0; i <= n; i++) adj.add(new ArrayList<>());
    for (int[] t : times) adj.get(t[0]).add(new int[]{t[1], t[2]});
    int[] dist = new int[n + 1];
    Arrays.fill(dist, Integer.MAX_VALUE);
    dist[k] = 0;
    PriorityQueue<int[]> pq = new PriorityQueue<>((a, b) -> a[1] - b[1]);  // {node, dist}
    pq.offer(new int[]{k, 0});
    while (!pq.isEmpty()) {
        int[] cur = pq.poll();
        if (cur[1] > dist[cur[0]]) continue;                              // stale
        for (int[] e : adj.get(cur[0])) {
            int nd = cur[1] + e[1];
            if (nd < dist[e[0]]) { dist[e[0]] = nd; pq.offer(new int[]{e[0], nd}); }
        }
    }
    int max = 0;
    for (int i = 1; i <= n; i++) {
        if (dist[i] == Integer.MAX_VALUE) return -1;
        max = Math.max(max, dist[i]);
    }
    return max;
}
```

### Cheapest Flights Within K Stops (Bellman-Ford)
**Category:** Tier 2 · Reinforce
**Pattern:** Bounded Bellman-Ford (≤ K+1 edges).  **Time:** O(K·E)  **Space:** O(V).
**Approach:** Relax all edges exactly K+1 times (K stops means at most K+1 flights). To prevent using updates made in the same round, relax from a snapshot of the previous round's distances. The result for `dst` is the cheapest such bounded-hop price.

```java
public int findCheapestPrice(int n, int[][] flights, int src, int dst, int k) {
    int[] dist = new int[n];
    Arrays.fill(dist, Integer.MAX_VALUE);
    dist[src] = 0;
    for (int i = 0; i <= k; i++) {
        int[] prev = dist.clone();                       // snapshot
        for (int[] f : flights) {
            if (prev[f[0]] == Integer.MAX_VALUE) continue;
            dist[f[1]] = Math.min(dist[f[1]], prev[f[0]] + f[2]);
        }
    }
    return dist[dst] == Integer.MAX_VALUE ? -1 : dist[dst];
}
```

### Path with Minimum Effort (Dijkstra-style)
**Category:** Tier 3 · Reference
**Pattern:** Dijkstra where cost = max edge on path (minimax).  **Time:** O(m·n·log(m·n))  **Space:** O(m·n).
**Approach:** Define a path's effort as the maximum absolute height difference along it; we want the path minimizing that maximum. Run a Dijkstra variant where the "distance" of a cell is the smallest possible max-difference to reach it, popping the lowest-effort cell first.

```java
public int minimumEffortPath(int[][] heights) {
    int m = heights.length, n = heights[0].length;
    int[][] effort = new int[m][n];
    for (int[] row : effort) Arrays.fill(row, Integer.MAX_VALUE);
    effort[0][0] = 0;
    PriorityQueue<int[]> pq = new PriorityQueue<>((a, b) -> a[0] - b[0]); // {effort, r, c}
    pq.offer(new int[]{0, 0, 0});
    int[][] dirs = {{1,0},{-1,0},{0,1},{0,-1}};
    while (!pq.isEmpty()) {
        int[] cur = pq.poll();
        int e = cur[0], r = cur[1], c = cur[2];
        if (r == m - 1 && c == n - 1) return e;
        if (e > effort[r][c]) continue;
        for (int[] d : dirs) {
            int nr = r + d[0], nc = c + d[1];
            if (nr >= 0 && nr < m && nc >= 0 && nc < n) {
                int ne = Math.max(e, Math.abs(heights[nr][nc] - heights[r][c]));
                if (ne < effort[nr][nc]) { effort[nr][nc] = ne; pq.offer(new int[]{ne, nr, nc}); }
            }
        }
    }
    return 0;
}
```

### Floyd-Warshall template
**Category:** 🧩 Template
**Pattern:** All-pairs shortest path via DP.  **Time:** O(V³)  **Space:** O(V²).
**Approach:** For every intermediate node `k`, try improving every pair (i, j) by routing through k. After processing all k, `dist[i][j]` holds the shortest distance. Handles negative edges (no negative cycles); use a large sentinel for "no edge" and guard against overflow.

```java
void floydWarshall(int[][] dist) {   // dist[i][j] init: 0 on diagonal, edge weight, else INF
    int n = dist.length;
    final int INF = Integer.MAX_VALUE / 2;   // avoid overflow on addition
    for (int k = 0; k < n; k++)
        for (int i = 0; i < n; i++)
            for (int j = 0; j < n; j++)
                if (dist[i][k] + dist[k][j] < dist[i][j])
                    dist[i][j] = dist[i][k] + dist[k][j];
}
```

---

## Minimum Spanning Tree

### Min Cost to Connect All Points — Kruskal
**Category:** Tier 2 · Reinforce
**Pattern:** Sort edges, union greedily.  **Time:** O(n² log n)  **Space:** O(n²).
**Approach:** Build all pairwise Manhattan-distance edges, sort ascending, and add an edge to the MST only if it joins two different components (DSU prevents cycles). Stop once n-1 edges are chosen.

```java
public int minCostConnectPoints(int[][] points) {
    int n = points.length;
    List<int[]> edges = new ArrayList<>();          // {weight, i, j}
    for (int i = 0; i < n; i++)
        for (int j = i + 1; j < n; j++) {
            int w = Math.abs(points[i][0] - points[j][0]) + Math.abs(points[i][1] - points[j][1]);
            edges.add(new int[]{w, i, j});
        }
    edges.sort((a, b) -> a[0] - b[0]);
    DSU dsu = new DSU(n);
    int cost = 0, used = 0;
    for (int[] e : edges) {
        if (dsu.union(e[1], e[2])) {
            cost += e[0];
            if (++used == n - 1) break;
        }
    }
    return cost;
}
```

### Min Cost to Connect All Points — Prim
**Category:** Tier 2 · Reinforce
**Pattern:** Grow MST from one node with a min-heap.  **Time:** O(n² log n)  **Space:** O(n).
**Approach:** Start from any point; repeatedly pull the cheapest edge connecting the tree to an unvisited point, add its weight, and push that point's edges to all unvisited points. Each point is finalized once; finish when all n are in the tree.

```java
public int minCostConnectPointsPrim(int[][] points) {
    int n = points.length;
    boolean[] inMST = new boolean[n];
    PriorityQueue<int[]> pq = new PriorityQueue<>((a, b) -> a[0] - b[0]); // {cost, node}
    pq.offer(new int[]{0, 0});
    int cost = 0, count = 0;
    while (count < n) {
        int[] cur = pq.poll();
        int w = cur[0], u = cur[1];
        if (inMST[u]) continue;
        inMST[u] = true; cost += w; count++;
        for (int v = 0; v < n; v++) {
            if (!inMST[v]) {
                int d = Math.abs(points[u][0] - points[v][0]) + Math.abs(points[u][1] - points[v][1]);
                pq.offer(new int[]{d, v});
            }
        }
    }
    return cost;
}
```

---

## Other

### Is Graph Bipartite?
**Category:** Tier 3 · Reference
**Pattern:** 2-coloring via BFS/DFS.  **Time:** O(V + E)  **Space:** O(V).
**Approach:** Try to color the graph with two colors so that no edge joins same-colored nodes. BFS each uncolored component, assigning the opposite color to each neighbor; a conflict (a neighbor already has the same color) proves it is not bipartite.

```java
public boolean isBipartite(int[][] graph) {
    int n = graph.length;
    int[] color = new int[n];           // 0 = uncolored, 1 / -1 = colors
    for (int i = 0; i < n; i++) {
        if (color[i] != 0) continue;
        Queue<Integer> q = new ArrayDeque<>();
        q.offer(i); color[i] = 1;
        while (!q.isEmpty()) {
            int u = q.poll();
            for (int v : graph[u]) {
                if (color[v] == color[u]) return false;
                if (color[v] == 0) { color[v] = -color[u]; q.offer(v); }
            }
        }
    }
    return true;
}
```

### Reconstruct Itinerary (Hierholzer / Eulerian path)
**Category:** Tier 3 · Reference
**Pattern:** Hierholzer's algorithm for an Eulerian path.  **Time:** O(E log E)  **Space:** O(E).
**Approach:** Every ticket is a directed edge; we need an Eulerian path starting at "JFK" using each edge once. Keep destinations sorted (lexical order) per origin. DFS greedily, and on backtracking prepend the node to the route — this yields the valid itinerary in reverse, so reverse it at the end.

```java
public List<String> findItinerary(List<List<String>> tickets) {
    Map<String, PriorityQueue<String>> adj = new HashMap<>();
    for (List<String> t : tickets)
        adj.computeIfAbsent(t.get(0), k -> new PriorityQueue<>()).add(t.get(1));
    LinkedList<String> route = new LinkedList<>();
    dfs("JFK", adj, route);
    return route;
}

private void dfs(String node, Map<String, PriorityQueue<String>> adj, LinkedList<String> route) {
    PriorityQueue<String> dests = adj.get(node);
    while (dests != null && !dests.isEmpty())
        dfs(dests.poll(), adj, route);
    route.addFirst(node);    // add on the way back (post-order)
}
```

---

## Quick reference

| Need | Use |
|------|-----|
| Connected components / cycle in undirected | Union-Find or DFS |
| Shortest path, unweighted | BFS (multi-source if many starts) |
| Shortest path, non-negative weights | Dijkstra (min-heap) |
| Shortest path, negative weights / hop limit | Bellman-Ford |
| All-pairs shortest path | Floyd-Warshall (O(V³)) |
| Ordering with dependencies / cycle in directed | Topological sort (Kahn's or DFS) |
| Minimum spanning tree | Kruskal (DSU) or Prim (heap) |
| Two-group partition | Bipartite 2-coloring |
| Use-every-edge-once path | Hierholzer (Eulerian) |
