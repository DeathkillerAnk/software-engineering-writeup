# 06 · Graphs

Graph traversal, ordering, connectivity, and shortest-path patterns with reusable Java templates.

---

## Core building blocks

### Adjacency list building
**Category:** 🧩 Template


<!-- Problem Statement not automatically found -->

```java
import java.util.*; // Import utility classes like List, ArrayList

// From edge list. n = number of nodes labeled 0..n-1.
List<List<Integer>> buildGraph(int n, int[][] edges, boolean directed) {
    List<List<Integer>> adj = new ArrayList<>(); // Create a list of lists to represent the adjacency list
    for (int i = 0; i < n; i++) adj.add(new ArrayList<>()); // Initialize an empty list for each node
    for (int[] e : edges) { // Iterate through the provided array of edges
        adj.get(e[0]).add(e[1]); // Add a directed edge from e[0] to e[1]
        if (!directed) adj.get(e[1]).add(e[0]); // If undirected, add the reverse edge from e[1] to e[0]
    }
    return adj; // Return the fully constructed adjacency list
}

// Weighted variant: store {neighbor, weight}.
List<List<int[]>> buildWeighted(int n, int[][] edges, boolean directed) {
    List<List<int[]>> adj = new ArrayList<>(); // Outer list stores lists of int[] pairs
    for (int i = 0; i < n; i++) adj.add(new ArrayList<>()); // Initialize empty lists for each node
    for (int[] e : edges) { // Iterate through each edge containing [source, dest, weight]
        adj.get(e[0]).add(new int[]{e[1], e[2]}); // Add dest node and weight to source's list
        if (!directed) adj.get(e[1]).add(new int[]{e[0], e[2]}); // Add reverse weighted edge if undirected
    }
    return adj; // Return the weighted adjacency list
}
```

### Generic BFS template
**Category:** 🧩 Template


<!-- Problem Statement not automatically found -->

```java
// Level-order traversal from a single source. Returns shortest #edges to each node.
int[] bfs(List<List<Integer>> adj, int start) {
    int n = adj.size(); // Number of total nodes in the graph
    int[] dist = new int[n]; // Array to store the shortest distance to each node
    Arrays.fill(dist, -1); // Initialize distances to -1 (representing unvisited)
    Queue<Integer> q = new ArrayDeque<>(); // Initialize a queue for BFS level-order traversal
    q.offer(start); // Add the starting node to the queue
    dist[start] = 0; // The distance to the starting node is 0
    while (!q.isEmpty()) { // Continue exploring while there are nodes in the queue
        int node = q.poll(); // Retrieve and remove the next node to process from the queue
        for (int next : adj.get(node)) { // Iterate over all adjacent neighbors of the current node
            if (dist[next] == -1) {          // unvisited; If neighbor hasn't been processed yet
                dist[next] = dist[node] + 1; // Set its distance to current node's distance + 1
                q.offer(next); // Add the unvisited neighbor to the queue for future processing
            }
        }
    }
    return dist; // Return the array containing shortest path distances from start
}
```

### Generic DFS template
**Category:** 🧩 Template


<!-- Problem Statement not automatically found -->

```java
// Recursive DFS marking visited.
void dfs(List<List<Integer>> adj, int node, boolean[] visited) {
    visited[node] = true; // Mark the current node as visited
    for (int next : adj.get(node)) { // Iterate through all neighboring nodes
        if (!visited[next]) dfs(adj, next, visited); // If neighbor is unvisited, recursively visit it
    }
}

// Iterative DFS (avoids stack overflow on deep graphs).
void dfsIterative(List<List<Integer>> adj, int start, boolean[] visited) {
    Deque<Integer> stack = new ArrayDeque<>(); // Use a stack (Deque) to simulate the call stack
    stack.push(start); // Push the starting node onto the stack
    while (!stack.isEmpty()) { // Keep processing until the stack is empty
        int node = stack.pop(); // Pop the top node from the stack
        if (visited[node]) continue; // If already visited, skip to the next iteration
        visited[node] = true; // Mark the current node as visited after popping
        for (int next : adj.get(node)) { // Iterate through all neighboring nodes
            if (!visited[next]) stack.push(next); // Push unvisited neighbors onto the stack for exploration
        }
    }
}
```

### Union-Find (DSU) — path compression + union by rank
**Category:** 🧩 Template


<!-- Problem Statement not automatically found -->

```java
class DSU {
    int[] parent, rank; // Arrays to store parent pointers and subtree ranks for union by rank
    int count;                 // number of disjoint components

    DSU(int n) {
        parent = new int[n]; // Initialize parent array of size n
        rank = new int[n]; // Initialize rank array of size n
        count = n; // Initially, every node is its own separate component
        for (int i = 0; i < n; i++) parent[i] = i; // Make each node point to itself as its parent
    }

    int find(int x) {                       // with path compression
        while (parent[x] != x) { // While the node is not its own parent (not the root)
            parent[x] = parent[parent[x]];   // halving: compress path by pointing node to its grandparent
            x = parent[x]; // Move up the tree to continue finding the root
        }
        return x; // Return the representative root of the set
    }

    boolean union(int a, int b) {            // by rank; returns false if already joined
        int ra = find(a), rb = find(b); // Find the roots of both components
        if (ra == rb) return false; // If they have the same root, they are already in the same set
        if (rank[ra] < rank[rb]) { int t = ra; ra = rb; rb = t; } // Ensure 'ra' points to the tree with equal or larger rank
        parent[rb] = ra; // Attach the smaller rank tree under the root of the larger rank tree
        if (rank[ra] == rank[rb]) rank[ra]++; // If ranks were equal, increment the rank of the new root
        count--; // Merging two separate components decreases total component count by 1
        return true; // Return true indicating a successful merge
    }

    boolean connected(int a, int b) { return find(a) == find(b); } // Return true if both nodes share the same root
}
```

> Near-constant amortized time per op: O(α(n)), where α is the inverse Ackermann function.

---

## Grid / Graph Traversal

### Number of Islands
**Category:** ⭐ Tier 1 · Core
**Pattern:** Grid DFS/BFS connected components.  **Time:** O(m·n)  **Space:** O(m·n) worst-case recursion.
**Approach:** Scan every cell; when an unvisited land cell ('1') is found, increment the count and flood the entire island by DFS, marking visited cells (overwrite to '0' in place) so they are not recounted. Each cell is visited at most once.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Number of Islands](https://leetcode.com/problems/number-of-islands/)


Given an `m x n` 2D binary grid `grid` which represents a map of `'1'`s (land) and `'0'`s (water), return *the number of islands*.

An **island** is surrounded by water and is formed by connecting adjacent lands horizontally or vertically. You may assume all four edges of the grid are all surrounded by water.

 

<strong class="example">Example 1:</strong>

```text

**Input:** grid = [
  ["1","1","1","1","0"],
  ["1","1","0","1","0"],
  ["1","1","0","0","0"],
  ["0","0","0","0","0"]
]
**Output:** 1

```

<strong class="example">Example 2:</strong>

```text

**Input:** grid = [
  ["1","1","0","0","0"],
  ["1","1","0","0","0"],
  ["0","0","1","0","0"],
  ["0","0","0","1","1"]
]
**Output:** 3

```

 

**Constraints:**

	- `m == grid.length`

	- `n == grid[i].length`

	- `1 <= m, n <= 300`

	- `grid[i][j]` is `'0'` or `'1'`.

</details>

```java
public int numIslands(char[][] grid) {
    int m = grid.length, n = grid[0].length, count = 0; // Get grid dimensions and initialize island counter
    for (int i = 0; i < m; i++) // Iterate through every row
        for (int j = 0; j < n; j++) // Iterate through every column
            if (grid[i][j] == '1') { count++; sink(grid, i, j); } // If unvisited land is found, increment count and sink the whole island
    return count; // Return total number of islands discovered
}

private void sink(char[][] g, int i, int j) {
    if (i < 0 || i >= g.length || j < 0 || j >= g[0].length || g[i][j] != '1') return; // Out of bounds or already water/visited, return
    g[i][j] = '0'; // Mutate the land to water '0' to mark it as visited
    sink(g, i + 1, j); sink(g, i - 1, j); // Recursively sink bottom and top neighbors
    sink(g, i, j + 1); sink(g, i, j - 1); // Recursively sink right and left neighbors
}
```
**Alternative:** BFS with a queue if recursion depth is a concern; or a DSU over land cells.

### Flood Fill
**Category:** Tier 3 · Reference
**Pattern:** Grid DFS from a source.  **Time:** O(m·n)  **Space:** O(m·n).
**Approach:** Starting at (sr, sc), recolor all 4-directionally connected cells sharing the original color. Capture the start color first and stop early if it already equals the target (otherwise infinite recursion).


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Flood Fill](https://leetcode.com/problems/flood-fill/)


You are given an image represented by an `m x n` grid of integers `image`, where `image[i][j]` represents the pixel value of the image. You are also given three integers `sr`, `sc`, and `color`. Your task is to perform a **flood fill** on the image starting from the pixel `image[sr][sc]`.

To perform a **flood fill**:

<ol>
	- Begin with the starting pixel and change its color to `color`.

	- Perform the same process for each pixel that is **directly adjacent** (pixels that share a side with the original pixel, either horizontally or vertically) and shares the **same color** as the starting pixel.

	- Keep **repeating** this process by checking neighboring pixels of the *updated* pixels and modifying their color if it matches the original color of the starting pixel.

	- The process **stops** when there are **no more** adjacent pixels of the original color to update.

</ol>

Return the **modified** image after performing the flood fill.

 

<strong class="example">Example 1:</strong>

<div class="example-block">

**Input:** <span class="example-io">image = [[1,1,1],[1,1,0],[1,0,1]], sr = 1, sc = 1, color = 2</span>

**Output:** <span class="example-io">[[2,2,2],[2,2,0],[2,0,1]]</span>

**Explanation:**

<img alt="" src="https://assets.leetcode.com/uploads/2021/06/01/flood1-grid.jpg" style="width: 613px; height: 253px;" />

From the center of the image with position `(sr, sc) = (1, 1)` (i.e., the red pixel), all pixels connected by a path of the same color as the starting pixel (i.e., the blue pixels) are colored with the new color.

Note the bottom corner is **not** colored 2, because it is not horizontally or vertically connected to the starting pixel.
</div>

<strong class="example">Example 2:</strong>

<div class="example-block">

**Input:** <span class="example-io">image = [[0,0,0],[0,0,0]], sr = 0, sc = 0, color = 0</span>

**Output:** <span class="example-io">[[0,0,0],[0,0,0]]</span>

**Explanation:**

The starting pixel is already colored with 0, which is the same as the target color. Therefore, no changes are made to the image.
</div>

 

**Constraints:**

	- `m == image.length`

	- `n == image[i].length`

	- `1 <= m, n <= 50`

	- `0 <= image[i][j], color < 2<sup>16</sup>`

	- `0 <= sr < m`

	- `0 <= sc < n`

</details>

```java
public int[][] floodFill(int[][] image, int sr, int sc, int color) {
    int start = image[sr][sc]; // Store the original color of the starting pixel
    if (start != color) fill(image, sr, sc, start, color); // If the new color is different, initiate the flood fill
    return image; // Return the modified image grid
}

private void fill(int[][] img, int i, int j, int from, int to) {
    if (i < 0 || i >= img.length || j < 0 || j >= img[0].length || img[i][j] != from) return; // Stop if out of bounds or color doesn't match the original
    img[i][j] = to; // Update the current pixel to the new target color
    fill(img, i + 1, j, from, to); fill(img, i - 1, j, from, to); // Recursively fill the bottom and top adjacent pixels
    fill(img, i, j + 1, from, to); fill(img, i, j - 1, from, to); // Recursively fill the right and left adjacent pixels
}
```

### Clone Graph
**Category:** Tier 2 · Reinforce
**Pattern:** DFS/BFS with a visited map (old → new).  **Time:** O(V + E)  **Space:** O(V).
**Approach:** Traverse the graph; for each original node create its clone once and store it in a map. When visiting neighbors, look up (or create) clones and wire them into the cloned node's neighbor list. The map both deduplicates and breaks cycles.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Clone Graph](https://leetcode.com/problems/clone-graph/)


Given a reference of a node in a **<a href="https://en.wikipedia.org/wiki/Connectivity_(graph_theory)#Connected_graph" target="_blank">connected</a>** undirected graph.

Return a <a href="https://en.wikipedia.org/wiki/Object_copying#Deep_copy" target="_blank">**deep copy**</a> (clone) of the graph.

Each node in the graph contains a value (`int`) and a list (`List[Node]`) of its neighbors.

```text

class Node {
    public int val;
    public List<Node> neighbors;
}

```

 

**Test case format:**

For simplicity, each node's value is the same as the node's index (1-indexed). For example, the first node with `val == 1`, the second node with `val == 2`, and so on. The graph is represented in the test case using an adjacency list.

**An adjacency list** is a collection of unordered **lists** used to represent a finite graph. Each list describes the set of neighbors of a node in the graph.

The given node will always be the first node with `val = 1`. You must return the **copy of the given node** as a reference to the cloned graph.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2019/11/04/133_clone_graph_question.png" style="width: 454px; height: 500px;" />

```text

**Input:** adjList = [[2,4],[1,3],[2,4],[1,3]]
**Output:** [[2,4],[1,3],[2,4],[1,3]]
**Explanation:** There are 4 nodes in the graph.
1st node (val = 1)'s neighbors are 2nd node (val = 2) and 4th node (val = 4).
2nd node (val = 2)'s neighbors are 1st node (val = 1) and 3rd node (val = 3).
3rd node (val = 3)'s neighbors are 2nd node (val = 2) and 4th node (val = 4).
4th node (val = 4)'s neighbors are 1st node (val = 1) and 3rd node (val = 3).

```

<strong class="example">Example 2:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2020/01/07/graph.png" style="width: 163px; height: 148px;" />

```text

**Input:** adjList = [[]]
**Output:** [[]]
**Explanation:** Note that the input contains one empty list. The graph consists of only one node with val = 1 and it does not have any neighbors.

```

<strong class="example">Example 3:</strong>

```text

**Input:** adjList = []
**Output:** []
**Explanation:** This an empty graph, it does not have any nodes.

```

 

**Constraints:**

	- The number of nodes in the graph is in the range `[0, 100]`.

	- `1 <= Node.val <= 100`

	- `Node.val` is unique for each node.

	- There are no repeated edges and no self-loops in the graph.

	- The Graph is connected and all nodes can be visited starting from the given node.

</details>

```java
class Node {
    public int val; // Node value
    public List<Node> neighbors; // List of adjacent neighboring nodes
    public Node(int v) { val = v; neighbors = new ArrayList<>(); } // Constructor to initialize node and its neighbor list
}

public Node cloneGraph(Node node) {
    if (node == null) return null; // Handle edge case of an empty graph
    Map<Node, Node> seen = new HashMap<>(); // Hash map to track visited nodes and map original to cloned nodes
    return dfs(node, seen); // Start DFS traversal to clone the graph
}

private Node dfs(Node node, Map<Node, Node> seen) {
    if (seen.containsKey(node)) return seen.get(node); // If already cloned, return the existing clone to prevent cycles
    Node copy = new Node(node.val); // Create a new cloned node with the same value
    seen.put(node, copy); // Store the clone in the map immediately before visiting neighbors
    for (Node nb : node.neighbors) copy.neighbors.add(dfs(nb, seen)); // Recursively clone all neighbors and add them to the clone's neighbor list
    return copy; // Return the fully constructed cloned node
}
```

### Number of Connected Components (in an Undirected Graph)
**Category:** Tier 3 · Reference
**Pattern:** Union-Find (or DFS).  **Time:** O(V + E·α)  **Space:** O(V).
**Approach:** Start with n components. Union the endpoints of each edge; every successful union (joining two previously separate sets) reduces the component count by one. The DSU's `count` field is the answer.


<!-- Problem Statement not automatically found -->

```java
public int countComponents(int n, int[][] edges) {
    DSU dsu = new DSU(n); // Initialize Disjoint Set Union data structure for n nodes
    for (int[] e : edges) dsu.union(e[0], e[1]); // Process each edge, merging components if they belong to different sets
    return dsu.count; // Return the final number of disjoint components tracked by the DSU
}
```
**Alternative:** DFS from each unvisited node, counting how many DFS launches occur.

### Surrounded Regions
**Category:** Tier 3 · Reference
**Pattern:** Reverse flood — mark border-connected regions first.  **Time:** O(m·n)  **Space:** O(m·n).
**Approach:** A region of 'O' survives only if it touches the border. DFS from every border 'O', temporarily marking connected 'O's as safe ('#'). After that, flip all remaining 'O' (truly surrounded) to 'X' and restore the safe '#' back to 'O'.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Surrounded Regions](https://leetcode.com/problems/surrounded-regions/)


You are given an `m x n` matrix `board` containing **letters** `'X'` and `'O'`, **capture regions** that are **surrounded**:

	- **Connect**: A cell is connected to adjacent cells horizontally or vertically.

	- **Region**: To form a region **connect every** `'O'` cell.

	- **Surround**: A region is surrounded if none of the `'O'` cells in that region are on the edge of the board. Such regions are **completely enclosed **by `'X'` cells.

To capture a **surrounded region**, replace all `'O'`s with `'X'`s **in-place** within the original board. You do not need to return anything.

 

<strong class="example">Example 1:</strong>

<div class="example-block">

**Input:** <span class="example-io">board = [["X","X","X","X"],["X","O","O","X"],["X","X","O","X"],["X","O","X","X"]]</span>

**Output:** <span class="example-io">[["X","X","X","X"],["X","X","X","X"],["X","X","X","X"],["X","O","X","X"]]</span>

**Explanation:**
<img alt="" src="https://assets.leetcode.com/uploads/2021/02/19/xogrid.jpg" style="width: 367px; height: 158px;" />

In the above diagram, the bottom region is not captured because it is on the edge of the board and cannot be surrounded.
</div>

<strong class="example">Example 2:</strong>

<div class="example-block">

**Input:** <span class="example-io">board = [["X"]]</span>

**Output:** <span class="example-io">[["X"]]</span>
</div>

 

**Constraints:**

	- `m == board.length`

	- `n == board[i].length`

	- `1 <= m, n <= 200`

	- `board[i][j]` is `'X'` or `'O'`.

</details>

```java
public void solve(char[][] board) {
    int m = board.length, n = board[0].length; // Get the dimensions of the board
    for (int i = 0; i < m; i++) { guard(board, i, 0); guard(board, i, n - 1); } // Run DFS from all 'O's on the left and right edges
    for (int j = 0; j < n; j++) { guard(board, 0, j); guard(board, m - 1, j); } // Run DFS from all 'O's on the top and bottom edges
    for (int i = 0; i < m; i++) // Iterate through the entire board
        for (int j = 0; j < n; j++) // Iterate through each column
            board[i][j] = board[i][j] == '#' ? 'O' : 'X'; // Convert safe '#' back to 'O', and capture all remaining unsurrounded 'O's to 'X'
}

private void guard(char[][] b, int i, int j) {
    if (i < 0 || i >= b.length || j < 0 || j >= b[0].length || b[i][j] != 'O') return; // Stop if out of bounds or not an 'O'
    b[i][j] = '#'; // Mark this border-connected 'O' temporarily as a safe '#'
    guard(b, i + 1, j); guard(b, i - 1, j); // Recursively explore bottom and top neighbors
    guard(b, i, j + 1); guard(b, i, j - 1); // Recursively explore right and left neighbors
}
```

### Pacific Atlantic Water Flow
**Category:** Tier 2 · Reinforce
**Pattern:** Multi-source DFS from both oceans.  **Time:** O(m·n)  **Space:** O(m·n).
**Approach:** Instead of testing each cell, flow water backward from the ocean borders uphill (to neighbors with height ≥ current). Cells reachable from the Pacific border form one set, from the Atlantic border another; the answer is their intersection.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Pacific Atlantic Water Flow](https://leetcode.com/problems/pacific-atlantic-water-flow/)


There is an `m x n` rectangular island that borders both the **Pacific Ocean** and **Atlantic Ocean**. The **Pacific Ocean** touches the island's left and top edges, and the **Atlantic Ocean** touches the island's right and bottom edges.

The island is partitioned into a grid of square cells. You are given an `m x n` integer matrix `heights` where `heights[r][c]` represents the **height above sea level** of the cell at coordinate `(r, c)`.

The island receives a lot of rain, and the rain water can flow to neighboring cells directly north, south, east, and west if the neighboring cell's height is **less than or equal to** the current cell's height. Water can flow from any cell adjacent to an ocean into the ocean.

Return *a **2D list** of grid coordinates *`result`* where *`result[i] = [r<sub>i</sub>, c<sub>i</sub>]`* denotes that rain water can flow from cell *`(r<sub>i</sub>, c<sub>i</sub>)`* to **both** the Pacific and Atlantic oceans*.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2021/06/08/waterflow-grid.jpg" style="width: 400px; height: 400px;" />

```text

**Input:** heights = [[1,2,2,3,5],[3,2,3,4,4],[2,4,5,3,1],[6,7,1,4,5],[5,1,1,2,4]]
**Output:** [[0,4],[1,3],[1,4],[2,2],[3,0],[3,1],[4,0]]
**Explanation:** The following cells can flow to the Pacific and Atlantic oceans, as shown below:
[0,4]: [0,4] -> Pacific Ocean 
       [0,4] -> Atlantic Ocean
[1,3]: [1,3] -> [0,3] -> Pacific Ocean 
       [1,3] -> [1,4] -> Atlantic Ocean
[1,4]: [1,4] -> [1,3] -> [0,3] -> Pacific Ocean 
       [1,4] -> Atlantic Ocean
[2,2]: [2,2] -> [1,2] -> [0,2] -> Pacific Ocean 
       [2,2] -> [2,3] -> [2,4] -> Atlantic Ocean
[3,0]: [3,0] -> Pacific Ocean 
       [3,0] -> [4,0] -> Atlantic Ocean
[3,1]: [3,1] -> [3,0] -> Pacific Ocean 
       [3,1] -> [4,1] -> Atlantic Ocean
[4,0]: [4,0] -> Pacific Ocean 
       [4,0] -> Atlantic Ocean
Note that there are other possible paths for these cells to flow to the Pacific and Atlantic oceans.

```

<strong class="example">Example 2:</strong>

```text

**Input:** heights = [[1]]
**Output:** [[0,0]]
**Explanation:** The water can flow from the only cell to the Pacific and Atlantic oceans.

```

 

**Constraints:**

	- `m == heights.length`

	- `n == heights[r].length`

	- `1 <= m, n <= 200`

	- `0 <= heights[r][c] <= 10<sup>5</sup>`

</details>

```java
public List<List<Integer>> pacificAtlantic(int[][] h) {
    int m = h.length, n = h[0].length; // Get dimensions of the height matrix
    boolean[][] pac = new boolean[m][n], atl = new boolean[m][n]; // Arrays to track cells reachable from Pacific and Atlantic
    for (int i = 0; i < m; i++) { flow(h, i, 0, pac); flow(h, i, n - 1, atl); } // Flow inwards from left (Pacific) and right (Atlantic) edges
    for (int j = 0; j < n; j++) { flow(h, 0, j, pac); flow(h, m - 1, j, atl); } // Flow inwards from top (Pacific) and bottom (Atlantic) edges
    List<List<Integer>> res = new ArrayList<>(); // List to store coordinates that can reach both oceans
    for (int i = 0; i < m; i++) // Iterate over all rows
        for (int j = 0; j < n; j++) // Iterate over all columns
            if (pac[i][j] && atl[i][j]) res.add(List.of(i, j)); // If cell is reachable by both, add to results
    return res; // Return the valid coordinates
}

private void flow(int[][] h, int i, int j, boolean[][] seen) {
    seen[i][j] = true; // Mark current cell as reachable from the respective ocean
    int[][] dirs = {{1,0},{-1,0},{0,1},{0,-1}}; // Four possible directions for water flow
    for (int[] d : dirs) { // Try each direction
        int ni = i + d[0], nj = j + d[1]; // Calculate neighbor coordinates
        if (ni >= 0 && ni < h.length && nj >= 0 && nj < h[0].length // Check bounds
                && !seen[ni][nj] && h[ni][nj] >= h[i][j]) // Ensure neighbor is unvisited and has height >= current (water flows uphill recursively)
            flow(h, ni, nj, seen); // Continue flow from the neighbor
    }
}
```

### Max Area of Island
**Category:** Tier 3 · Reference
**Pattern:** Grid DFS returning subtree size.  **Time:** O(m·n)  **Space:** O(m·n).
**Approach:** Same island flooding as Number of Islands, but each DFS returns the count of cells it sank; track the maximum across all islands. Sinking visited land prevents double counting.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Max Area of Island](https://leetcode.com/problems/max-area-of-island/)


You are given an `m x n` binary matrix `grid`. An island is a group of `1`'s (representing land) connected **4-directionally** (horizontal or vertical.) You may assume all four edges of the grid are surrounded by water.

The **area** of an island is the number of cells with a value `1` in the island.

Return *the maximum **area** of an island in *`grid`. If there is no island, return `0`.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2021/05/01/maxarea1-grid.jpg" style="width: 500px; height: 310px;" />

```text

**Input:** grid = [[0,0,1,0,0,0,0,1,0,0,0,0,0],[0,0,0,0,0,0,0,1,1,1,0,0,0],[0,1,1,0,1,0,0,0,0,0,0,0,0],[0,1,0,0,1,1,0,0,1,0,1,0,0],[0,1,0,0,1,1,0,0,1,1,1,0,0],[0,0,0,0,0,0,0,0,0,0,1,0,0],[0,0,0,0,0,0,0,1,1,1,0,0,0],[0,0,0,0,0,0,0,1,1,0,0,0,0]]
**Output:** 6
**Explanation:** The answer is not 11, because the island must be connected 4-directionally.

```

<strong class="example">Example 2:</strong>

```text

**Input:** grid = [[0,0,0,0,0,0,0,0]]
**Output:** 0

```

 

**Constraints:**

	- `m == grid.length`

	- `n == grid[i].length`

	- `1 <= m, n <= 50`

	- `grid[i][j]` is either `0` or `1`.

</details>

```java
public int maxAreaOfIsland(int[][] grid) {
    int best = 0; // Initialize variable to store the maximum island area found
    for (int i = 0; i < grid.length; i++) // Iterate through each row of the grid
        for (int j = 0; j < grid[0].length; j++) // Iterate through each column
            if (grid[i][j] == 1) best = Math.max(best, area(grid, i, j)); // If land is found, calculate its area and update the best max area
    return best; // Return the maximum area found
}

private int area(int[][] g, int i, int j) {
    if (i < 0 || i >= g.length || j < 0 || j >= g[0].length || g[i][j] != 1) return 0; // Base case: return 0 if out of bounds or not land
    g[i][j] = 0; // Mark the land cell as visited by sinking it to water (0)
    // Recursively calculate the area by adding 1 (current cell) to the area of 4-directional neighbors
    return 1 + area(g, i + 1, j) + area(g, i - 1, j) + area(g, i, j + 1) + area(g, i, j - 1);
}
```

---

## BFS Shortest Path (unweighted)

### Rotting Oranges
**Category:** ⭐ Tier 1 · Core
**Pattern:** Multi-source BFS over a grid.  **Time:** O(m·n)  **Space:** O(m·n).
**Approach:** Seed the queue with all initially rotten oranges (time 0) and count fresh oranges. BFS level by level; each level is one minute, and rotting a fresh neighbor decrements the fresh count. Return the last minute, or -1 if any fresh orange remains.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Rotting Oranges](https://leetcode.com/problems/rotting-oranges/)


You are given an `m x n` `grid` where each cell can have one of three values:

	- `0` representing an empty cell,

	- `1` representing a fresh orange, or

	- `2` representing a rotten orange.

Every minute, any fresh orange that is **4-directionally adjacent** to a rotten orange becomes rotten.

Return *the minimum number of minutes that must elapse until no cell has a fresh orange*. If *this is impossible, return* `-1`.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2019/02/16/oranges.png" style="width: 650px; height: 137px;" />

```text

**Input:** grid = [[2,1,1],[1,1,0],[0,1,1]]
**Output:** 4

```

<strong class="example">Example 2:</strong>

```text

**Input:** grid = [[2,1,1],[0,1,1],[1,0,1]]
**Output:** -1
**Explanation:** The orange in the bottom left corner (row 2, column 0) is never rotten, because rotting only happens 4-directionally.

```

<strong class="example">Example 3:</strong>

```text

**Input:** grid = [[0,2]]
**Output:** 0
**Explanation:** Since there are already no fresh oranges at minute 0, the answer is just 0.

```

 

**Constraints:**

	- `m == grid.length`

	- `n == grid[i].length`

	- `1 <= m, n <= 10`

	- `grid[i][j]` is `0`, `1`, or `2`.

</details>

```java
public int orangesRotting(int[][] grid) {
    int m = grid.length, n = grid[0].length, fresh = 0, minutes = 0; // Initialize grid dimensions, fresh count, and minute tracker
    Queue<int[]> q = new ArrayDeque<>(); // Queue for multi-source BFS
    for (int i = 0; i < m; i++) // Scan entire grid to setup initial state
        for (int j = 0; j < n; j++) {
            if (grid[i][j] == 2) q.offer(new int[]{i, j}); // Add all rotten oranges to queue (level 0)
            else if (grid[i][j] == 1) fresh++; // Count the total number of fresh oranges
        }
    int[][] dirs = {{1,0},{-1,0},{0,1},{0,-1}}; // 4 directional movements
    while (!q.isEmpty() && fresh > 0) { // Continue BFS while queue isn't empty and there are still fresh oranges
        minutes++; // Increment minutes for the new BFS level
        for (int sz = q.size(); sz > 0; sz--) { // Process all rotten oranges at the current minute (level)
            int[] cur = q.poll(); // Get a rotten orange's coordinates
            for (int[] d : dirs) { // Check all 4 adjacent cells
                int ni = cur[0] + d[0], nj = cur[1] + d[1]; // Calculate adjacent coordinates
                if (ni >= 0 && ni < m && nj >= 0 && nj < n && grid[ni][nj] == 1) { // If adjacent is fresh
                    grid[ni][nj] = 2; fresh--; q.offer(new int[]{ni, nj}); // Rot it, decrement fresh count, and add to next minute's queue
                }
            }
        }
    }
    return fresh == 0 ? minutes : -1; // If all fresh rotted, return minutes; otherwise -1 (impossible)
}
```

### 01 Matrix
**Category:** Tier 3 · Reference
**Pattern:** Multi-source BFS from all zeros.  **Time:** O(m·n)  **Space:** O(m·n).
**Approach:** The distance of each cell to the nearest 0 is computed by BFS seeded from every 0 simultaneously. Initialize 1-cells to "unvisited" and expand outward; the first time a cell is reached gives its shortest distance.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [01 Matrix](https://leetcode.com/problems/01-matrix/)


Given an `m x n` binary matrix `mat`, return *the distance of the nearest *`0`* for each cell*.

The distance between two cells sharing a common edge is `1`.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2021/04/24/01-1-grid.jpg" style="width: 253px; height: 253px;" />

```text

**Input:** mat = [[0,0,0],[0,1,0],[0,0,0]]
**Output:** [[0,0,0],[0,1,0],[0,0,0]]

```

<strong class="example">Example 2:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2021/04/24/01-2-grid.jpg" style="width: 253px; height: 253px;" />

```text

**Input:** mat = [[0,0,0],[0,1,0],[1,1,1]]
**Output:** [[0,0,0],[0,1,0],[1,2,1]]

```

 

**Constraints:**

	- `m == mat.length`

	- `n == mat[i].length`

	- `1 <= m, n <= 10<sup>4</sup>`

	- `1 <= m * n <= 10<sup>4</sup>`

	- `mat[i][j]` is either `0` or `1`.

	- There is at least one `0` in `mat`.

 

**Note:** This question is the same as 1765: <a href="https://leetcode.com/problems/map-of-highest-peak/description/" target="_blank">https://leetcode.com/problems/map-of-highest-peak/</a>

</details>

```java
public int[][] updateMatrix(int[][] mat) {
    int m = mat.length, n = mat[0].length; // Get matrix dimensions
    int[][] dist = new int[m][n]; // Distance matrix to return
    Queue<int[]> q = new ArrayDeque<>(); // Queue for multi-source BFS
    for (int i = 0; i < m; i++) // Iterate over the entire matrix
        for (int j = 0; j < n; j++) {
            if (mat[i][j] == 0) q.offer(new int[]{i, j}); // Zero cells are distance 0, push them as starting points
            else dist[i][j] = -1; // For 1-cells, initialize distance as unvisited (-1)
        }
    int[][] dirs = {{1,0},{-1,0},{0,1},{0,-1}}; // 4 directional movements
    while (!q.isEmpty()) { // Process the BFS queue
        int[] c = q.poll(); // Pop current cell
        for (int[] d : dirs) { // Try moving 4 directions
            int ni = c[0] + d[0], nj = c[1] + d[1]; // Get neighbor coordinates
            if (ni >= 0 && ni < m && nj >= 0 && nj < n && dist[ni][nj] == -1) { // If neighbor is valid and unvisited
                dist[ni][nj] = dist[c[0]][c[1]] + 1; // Shortest distance is current distance + 1
                q.offer(new int[]{ni, nj}); // Enqueue neighbor for subsequent expansion
            }
        }
    }
    return dist; // Return the completely populated distance matrix
}
```

### Word Ladder
**Category:** Tier 2 · Reinforce
**Pattern:** BFS over implicit word graph.  **Time:** O(N·L·26)  **Space:** O(N·L) (N words, L length).
**Approach:** Words are nodes; an edge connects words differing by one letter. BFS from `beginWord`, generating neighbors by trying all 26 letters at each position and checking membership in the word set. Return the level (number of words in the path) when `endWord` is reached.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Word Ladder](https://leetcode.com/problems/word-ladder/)


A **transformation sequence** from word `beginWord` to word `endWord` using a dictionary `wordList` is a sequence of words `beginWord -> s<sub>1</sub> -> s<sub>2</sub> -> ... -> s<sub>k</sub>` such that:

	- Every adjacent pair of words differs by a single letter.

	- Every `s<sub>i</sub>` for `1 <= i <= k` is in `wordList`. Note that `beginWord` does not need to be in `wordList`.

	- `s<sub>k</sub> == endWord`

Given two words, `beginWord` and `endWord`, and a dictionary `wordList`, return *the **number of words** in the **shortest transformation sequence** from* `beginWord` *to* `endWord`*, or *`0`* if no such sequence exists.*

 

<strong class="example">Example 1:</strong>

```text

**Input:** beginWord = "hit", endWord = "cog", wordList = ["hot","dot","dog","lot","log","cog"]
**Output:** 5
**Explanation:** One shortest transformation sequence is "hit" -> "hot" -> "dot" -> "dog" -> cog", which is 5 words long.

```

<strong class="example">Example 2:</strong>

```text

**Input:** beginWord = "hit", endWord = "cog", wordList = ["hot","dot","dog","lot","log"]
**Output:** 0
**Explanation:** The endWord "cog" is not in wordList, therefore there is no valid transformation sequence.

```

 

**Constraints:**

	- `1 <= beginWord.length <= 10`

	- `endWord.length == beginWord.length`

	- `1 <= wordList.length <= 5000`

	- `wordList[i].length == beginWord.length`

	- `beginWord`, `endWord`, and `wordList[i]` consist of lowercase English letters.

	- `beginWord != endWord`

	- All the words in `wordList` are **unique**.

</details>

```java
public int ladderLength(String beginWord, String endWord, List<String> wordList) {
    Set<String> dict = new HashSet<>(wordList); // Convert word list to a hash set for O(1) lookups
    if (!dict.contains(endWord)) return 0; // If endWord is not in the dictionary, no path exists
    Queue<String> q = new ArrayDeque<>(); // BFS queue to hold words at the current level
    q.offer(beginWord); // Start BFS with beginWord
    int level = 1; // Path length starts at 1 (inclusive of the start word itself)
    while (!q.isEmpty()) { // Continue until there are no more words to explore
        for (int sz = q.size(); sz > 0; sz--) { // Process the entire current level
            String w = q.poll(); // Get next word to explore from the queue
            if (w.equals(endWord)) return level; // If target word is reached, return the path length
            char[] arr = w.toCharArray(); // Convert string to mutable character array
            for (int i = 0; i < arr.length; i++) { // Iterate through each character position in the word
                char orig = arr[i]; // Store original character to restore later
                for (char c = 'a'; c <= 'z'; c++) { // Try replacing with every lowercase English letter
                    arr[i] = c; // Substitute character
                    String next = new String(arr); // Create the new transformed word string
                    if (dict.remove(next)) q.offer(next);  // remove = mark visited; If valid, enqueue and remove from dict to avoid cycles
                }
                arr[i] = orig; // Backtrack and restore the original character for the next iteration
            }
        }
        level++; // Increment the path length after fully exploring the current level
    }
    return 0; // Return 0 if queue empties and no path is found
}
```
**Alternative:** Bidirectional BFS from both ends roughly halves the explored frontier.

### Shortest Path in Binary Matrix
**Category:** Tier 3 · Reference
**Pattern:** 8-directional grid BFS.  **Time:** O(n²)  **Space:** O(n²).
**Approach:** Move through 0-cells in 8 directions from top-left to bottom-right. BFS gives the minimum number of cells in the clear path; mark cells visited (set to 1) on enqueue to avoid revisits.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Shortest Path in Binary Matrix](https://leetcode.com/problems/shortest-path-in-binary-matrix/)


Given an `n x n` binary matrix `grid`, return *the length of the shortest **clear path** in the matrix*. If there is no clear path, return `-1`.

A **clear path** in a binary matrix is a path from the **top-left** cell (i.e., `(0, 0)`) to the **bottom-right** cell (i.e., `(n - 1, n - 1)`) such that:

	- All the visited cells of the path are `0`.

	- All the adjacent cells of the path are **8-directionally** connected (i.e., they are different and they share an edge or a corner).

The **length of a clear path** is the number of visited cells of this path.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2021/02/18/example1_1.png" style="width: 500px; height: 234px;" />

```text

**Input:** grid = [[0,1],[1,0]]
**Output:** 2

```

<strong class="example">Example 2:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2021/02/18/example2_1.png" style="height: 216px; width: 500px;" />

```text

**Input:** grid = [[0,0,0],[1,1,0],[1,1,0]]
**Output:** 4

```

<strong class="example">Example 3:</strong>

```text

**Input:** grid = [[1,0,0],[1,1,0],[1,1,0]]
**Output:** -1

```

 

**Constraints:**

	- `n == grid.length`

	- `n == grid[i].length`

	- `1 <= n <= 100`

	- `grid[i][j] is 0 or 1`

</details>

```java
public int shortestPathBinaryMatrix(int[][] grid) {
    int n = grid.length; // Get the grid size n x n
    if (grid[0][0] == 1 || grid[n-1][n-1] == 1) return -1; // Path is impossible if start or end is blocked (1)
    int[][] dirs = {{1,0},{-1,0},{0,1},{0,-1},{1,1},{1,-1},{-1,1},{-1,-1}}; // 8 directional movements allowed
    Queue<int[]> q = new ArrayDeque<>(); // BFS queue to store grid coordinates
    q.offer(new int[]{0, 0}); // Add starting point (top-left)
    grid[0][0] = 1; // Mutate grid to mark starting point as visited (to prevent revisiting)
    int len = 1; // Path length starts at 1 for the initial cell
    while (!q.isEmpty()) { // Continue BFS while there are reachable cells
        for (int sz = q.size(); sz > 0; sz--) { // Process all cells at the current BFS level
            int[] c = q.poll(); // Get next cell
            if (c[0] == n - 1 && c[1] == n - 1) return len; // If bottom-right reached, return the path length
            for (int[] d : dirs) { // Try all 8 possible directions
                int ni = c[0] + d[0], nj = c[1] + d[1]; // Compute neighbor coordinates
                if (ni >= 0 && ni < n && nj >= 0 && nj < n && grid[ni][nj] == 0) { // Check bounds and if it is an unvisited clear cell (0)
                    grid[ni][nj] = 1; q.offer(new int[]{ni, nj}); // Mark as visited immediately and enqueue
                }
            }
        }
        len++; // Increment path length for the next BFS frontier
    }
    return -1; // Return -1 if bottom-right is unreachable
}
```

### Open the Lock
**Category:** Tier 3 · Reference
**Pattern:** BFS over state graph (10000 states).  **Time:** O(10000·8)  **Space:** O(10000).
**Approach:** Each 4-digit combination is a state; neighbors turn one wheel up or down (8 per state). BFS from "0000", skipping deadends and visited states, until reaching the target. The level is the minimum number of turns.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Open the Lock](https://leetcode.com/problems/open-the-lock/)


You have a lock in front of you with 4 circular wheels. Each wheel has 10 slots: `'0', '1', '2', '3', '4', '5', '6', '7', '8', '9'`. The wheels can rotate freely and wrap around: for example we can turn `'9'` to be `'0'`, or `'0'` to be `'9'`. Each move consists of turning one wheel one slot.

The lock initially starts at `'0000'`, a string representing the state of the 4 wheels.

You are given a list of `deadends` dead ends, meaning if the lock displays any of these codes, the wheels of the lock will stop turning and you will be unable to open it.

Given a `target` representing the value of the wheels that will unlock the lock, return the minimum total number of turns required to open the lock, or -1 if it is impossible.

 

<strong class="example">Example 1:</strong>

```text

**Input:** deadends = ["0201","0101","0102","1212","2002"], target = "0202"
**Output:** 6
**Explanation:** 
A sequence of valid moves would be "0000" -> "1000" -> "1100" -> "1200" -> "1201" -> "1202" -> "0202".
Note that a sequence like "0000" -> "0001" -> "0002" -> "0102" -> "0202" would be invalid,
because the wheels of the lock become stuck after the display becomes the dead end "0102".

```

<strong class="example">Example 2:</strong>

```text

**Input:** deadends = ["8888"], target = "0009"
**Output:** 1
**Explanation:** We can turn the last wheel in reverse to move from "0000" -> "0009".

```

<strong class="example">Example 3:</strong>

```text

**Input:** deadends = ["8887","8889","8878","8898","8788","8988","7888","9888"], target = "8888"
**Output:** -1
**Explanation:** We cannot reach the target without getting stuck.

```

 

**Constraints:**

	- `1 <= deadends.length <= 500`

	- `deadends[i].length == 4`

	- `target.length == 4`

	- target **will not be** in the list `deadends`.

	- `target` and `deadends[i]` consist of digits only.

</details>

```java
public int openLock(String[] deadends, String target) {
    Set<String> dead = new HashSet<>(Arrays.asList(deadends)); // Convert deadends array to a HashSet for O(1) lookups
    if (dead.contains("0000")) return -1; // If the starting combination is a deadend, it's impossible to start
    Set<String> visited = new HashSet<>(); // Set to keep track of visited combinations to prevent loops
    Queue<String> q = new ArrayDeque<>(); // Queue for BFS traversal
    q.offer("0000"); visited.add("0000"); // Start with the initial lock state and mark it visited
    int turns = 0; // Track the minimum number of wheel turns
    while (!q.isEmpty()) { // Perform BFS level by level
        for (int sz = q.size(); sz > 0; sz--) { // Process all states at the current depth (turn count)
            String s = q.poll(); // Retrieve the next state from the queue
            if (s.equals(target)) return turns; // If the target state is reached, return the accumulated turns
            for (int i = 0; i < 4; i++) { // Iterate over each of the 4 wheels
                for (int delta = -1; delta <= 1; delta += 2) { // Try rotating the wheel backwards (-1) and forwards (+1)
                    char[] a = s.toCharArray(); // Convert the string state to a mutable char array
                    // Apply rotation and handle wrap-around using modulo 10 (e.g., '9' + 1 -> '0', '0' - 1 -> '9')
                    a[i] = (char) ('0' + ((a[i] - '0' + delta + 10) % 10));
                    String next = new String(a); // Form the new rotated combination string
                    // Add to queue if it's not a deadend and hasn't been visited before
                    if (!dead.contains(next) && visited.add(next)) q.offer(next);
                }
            }
        }
        turns++; // Increment turn count after completing a full level of BFS
    }
    return -1; // Target is unreachable
}
```

---

## Topological Sort

### Course Schedule
**Category:** ⭐ Tier 1 · Core
**Pattern:** Cycle detection in a DAG (Kahn's BFS).  **Time:** O(V + E)  **Space:** O(V + E).
**Approach:** Treat prerequisites as directed edges. Repeatedly remove nodes with in-degree 0; if all nodes can be removed, the graph is acyclic and all courses are finishable. A leftover means a cycle.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Course Schedule](https://leetcode.com/problems/course-schedule/)


There are a total of `numCourses` courses you have to take, labeled from `0` to `numCourses - 1`. You are given an array `prerequisites` where `prerequisites[i] = [a<sub>i</sub>, b<sub>i</sub>]` indicates that you **must** take course `b<sub>i</sub>` first if you want to take course `a<sub>i</sub>`.

	- For example, the pair `[0, 1]`, indicates that to take course `0` you have to first take course `1`.

Return `true` if you can finish all courses. Otherwise, return `false`.

 

<strong class="example">Example 1:</strong>

```text

**Input:** numCourses = 2, prerequisites = [[1,0]]
**Output:** true
**Explanation:** There are a total of 2 courses to take. 
To take course 1 you should have finished course 0. So it is possible.

```

<strong class="example">Example 2:</strong>

```text

**Input:** numCourses = 2, prerequisites = [[1,0],[0,1]]
**Output:** false
**Explanation:** There are a total of 2 courses to take. 
To take course 1 you should have finished course 0, and to take course 0 you should also have finished course 1. So it is impossible.

```

 

**Constraints:**

	- `1 <= numCourses <= 2000`

	- `0 <= prerequisites.length <= 5000`

	- `prerequisites[i].length == 2`

	- `0 <= a<sub>i</sub>, b<sub>i</sub> < numCourses`

	- All the pairs prerequisites[i] are **unique**.

</details>

```java
public boolean canFinish(int numCourses, int[][] prerequisites) {
    List<List<Integer>> adj = new ArrayList<>(); // Adjacency list for the directed prerequisite graph
    int[] indeg = new int[numCourses]; // Array to store the in-degree (number of prerequisites) for each course
    for (int i = 0; i < numCourses; i++) adj.add(new ArrayList<>()); // Initialize the adjacency list for each node
    for (int[] p : prerequisites) { adj.get(p[1]).add(p[0]); indeg[p[0]]++; } // Populate graph: p[1] must precede p[0], so edge is p[1] -> p[0]
    Queue<Integer> q = new ArrayDeque<>(); // Queue to process nodes with 0 in-degree (no remaining prerequisites)
    for (int i = 0; i < numCourses; i++) if (indeg[i] == 0) q.offer(i); // Add all inherently available courses to queue
    int done = 0; // Counter for the number of courses successfully completed
    while (!q.isEmpty()) { // Kahn's Algorithm for Topological Sorting
        int c = q.poll(); done++; // Take a course and increment the completed count
        for (int nx : adj.get(c)) if (--indeg[nx] == 0) q.offer(nx); // Decrement in-degree for dependent courses; if 0, they are now available
    }
    return done == numCourses; // If all courses were completed, no cycles exist; return true
}
```

### Course Schedule II
**Category:** Tier 2 · Reinforce
**Pattern:** Topological order (Kahn's BFS).  **Time:** O(V + E)  **Space:** O(V + E).
**Approach:** Same as Course Schedule but record the order in which zero-in-degree nodes are removed. If the order contains all courses it is a valid topological sequence; otherwise a cycle exists and we return an empty array.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Course Schedule II](https://leetcode.com/problems/course-schedule-ii/)


There are a total of `numCourses` courses you have to take, labeled from `0` to `numCourses - 1`. You are given an array `prerequisites` where `prerequisites[i] = [a<sub>i</sub>, b<sub>i</sub>]` indicates that you **must** take course `b<sub>i</sub>` first if you want to take course `a<sub>i</sub>`.

	- For example, the pair `[0, 1]`, indicates that to take course `0` you have to first take course `1`.

Return *the ordering of courses you should take to finish all courses*. If there are many valid answers, return **any** of them. If it is impossible to finish all courses, return **an empty array**.

 

<strong class="example">Example 1:</strong>

```text

**Input:** numCourses = 2, prerequisites = [[1,0]]
**Output:** [0,1]
**Explanation:** There are a total of 2 courses to take. To take course 1 you should have finished course 0. So the correct course order is [0,1].

```

<strong class="example">Example 2:</strong>

```text

**Input:** numCourses = 4, prerequisites = [[1,0],[2,0],[3,1],[3,2]]
**Output:** [0,2,1,3]
**Explanation:** There are a total of 4 courses to take. To take course 3 you should have finished both courses 1 and 2. Both courses 1 and 2 should be taken after you finished course 0.
So one correct course order is [0,1,2,3]. Another correct ordering is [0,2,1,3].

```

<strong class="example">Example 3:</strong>

```text

**Input:** numCourses = 1, prerequisites = []
**Output:** [0]

```

 

**Constraints:**

	- `1 <= numCourses <= 2000`

	- `0 <= prerequisites.length <= numCourses * (numCourses - 1)`

	- `prerequisites[i].length == 2`

	- `0 <= a<sub>i</sub>, b<sub>i</sub> < numCourses`

	- `a<sub>i</sub> != b<sub>i</sub>`

	- All the pairs `[a<sub>i</sub>, b<sub>i</sub>]` are **distinct**.

</details>

```java
public int[] findOrder(int numCourses, int[][] prerequisites) {
    List<List<Integer>> adj = new ArrayList<>(); // Adjacency list representation
    int[] indeg = new int[numCourses]; // Array tracking the number of incoming edges for each course
    for (int i = 0; i < numCourses; i++) adj.add(new ArrayList<>()); // Create empty neighbor lists
    for (int[] p : prerequisites) { adj.get(p[1]).add(p[0]); indeg[p[0]]++; } // Build graph edges p[1] -> p[0] and tally in-degrees
    Queue<Integer> q = new ArrayDeque<>(); // Queue to collect nodes with 0 dependencies
    for (int i = 0; i < numCourses; i++) if (indeg[i] == 0) q.offer(i); // Initialize queue with courses having no prerequisites
    int[] order = new int[numCourses]; // Array to record the valid topological ordering
    int idx = 0; // Index pointer for the order array
    while (!q.isEmpty()) { // Process all eligible nodes
        int c = q.poll(); // Dequeue the next available course
        order[idx++] = c; // Place the course in our topological sequence
        for (int nx : adj.get(c)) if (--indeg[nx] == 0) q.offer(nx); // Reduce dependencies for children and enqueue if they drop to 0
    }
    return idx == numCourses ? order : new int[0]; // If sequence length matches numCourses, it's a DAG; otherwise, cycle exists
}
```

### Alien Dictionary
**Category:** Tier 3 · Reference
**Pattern:** Build a precedence graph, then topological sort.  **Time:** O(C) total chars  **Space:** O(1) (≤26 nodes).
**Approach:** Compare each pair of adjacent words; the first differing character gives a directed edge (earlier char → later char). Edge case: if a word is a prefix of a shorter word that precedes it, the ordering is invalid. Then run Kahn's algorithm; a cycle means no valid order exists.


<!-- Problem Statement not automatically found -->

```java
public String alienOrder(String[] words) {
    Map<Character, Set<Character>> adj = new HashMap<>(); // Adjacency list for the character ordering graph
    Map<Character, Integer> indeg = new HashMap<>(); // In-degree map for Kahn's topological sort
    for (String w : words) // Iterate over all words
        for (char c : w.toCharArray()) { adj.putIfAbsent(c, new HashSet<>()); indeg.putIfAbsent(c, 0); } // Initialize maps for every unique character
    for (int i = 0; i < words.length - 1; i++) { // Compare each adjacent pair of words
        String a = words[i], b = words[i + 1]; // Get adjacent word pair
        int min = Math.min(a.length(), b.length()), j = 0; // Find the shorter length to avoid out of bounds
        while (j < min && a.charAt(j) == b.charAt(j)) j++; // Skip matching prefixes
        if (j == min) { if (a.length() > b.length()) return ""; }   // invalid prefix case: e.g., ["abc", "ab"] implies cycle
        else if (adj.get(a.charAt(j)).add(b.charAt(j))) // Add directed edge a.charAt(j) -> b.charAt(j) if not already added
            indeg.merge(b.charAt(j), 1, Integer::sum); // Increment the in-degree of the destination character
    }
    Queue<Character> q = new ArrayDeque<>(); // BFS queue to store characters with 0 in-degree
    for (char c : indeg.keySet()) if (indeg.get(c) == 0) q.offer(c); // Enqueue all starting characters
    StringBuilder sb = new StringBuilder(); // Builder for the final sorted sequence
    while (!q.isEmpty()) { // Process nodes
        char c = q.poll(); // Extract character with no remaining precedents
        sb.append(c); // Append it to the dictionary ordering
        for (char nx : adj.get(c)) if (indeg.merge(nx, -1, Integer::sum) == 0) q.offer(nx); // Decrement child in-degrees, enqueue if they reach 0
    }
    return sb.length() == indeg.size() ? sb.toString() : ""; // Return the sequence if all characters were processed (no cycles)
}
```
**Alternative (DFS variant):** Post-order DFS pushing finished nodes onto a stack; reverse the stack for the topo order. Use a 3-color (white/gray/black) marking to detect cycles.

```java
// DFS-based topological sort skeleton (0=unvisited, 1=in-stack, 2=done).
boolean dfsTopo(int node, List<List<Integer>> adj, int[] state, Deque<Integer> out) {
    state[node] = 1; // Mark current node as currently being visited (in the call stack)
    for (int nx : adj.get(node)) { // Iterate over all adjacent children
        if (state[nx] == 1) return false;                 // back edge => cycle: if a child is already in the stack, we found a cycle
        if (state[nx] == 0 && !dfsTopo(nx, adj, state, out)) return false; // Recursively visit unvisited children; fail fast if cycle detected deep down
    }
    state[node] = 2; // Mark node as fully processed (all descendants visited)
    out.push(node);                                       // push on finish: push to stack to assemble topological order in reverse
    return true; // DFS completed successfully without cycles
}
```

---

## Union-Find Problems

### Number of Provinces
**Category:** ⭐ Tier 1 · Core
**Pattern:** DSU over an adjacency matrix.  **Time:** O(n²·α)  **Space:** O(n).
**Approach:** Cities are nodes; `isConnected[i][j] == 1` is an edge. Union all directly connected city pairs; the number of remaining components is the number of provinces (the DSU `count`).


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Number of Provinces](https://leetcode.com/problems/number-of-provinces/)


There are `n` cities. Some of them are connected, while some are not. If city `a` is connected directly with city `b`, and city `b` is connected directly with city `c`, then city `a` is connected indirectly with city `c`.

A **province** is a group of directly or indirectly connected cities and no other cities outside of the group.

You are given an `n x n` matrix `isConnected` where `isConnected[i][j] = 1` if the `i<sup>th</sup>` city and the `j<sup>th</sup>` city are directly connected, and `isConnected[i][j] = 0` otherwise.

Return *the total number of **provinces***.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2020/12/24/graph1.jpg" style="width: 222px; height: 142px;" />

```text

**Input:** isConnected = [[1,1,0],[1,1,0],[0,0,1]]
**Output:** 2

```

<strong class="example">Example 2:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2020/12/24/graph2.jpg" style="width: 222px; height: 142px;" />

```text

**Input:** isConnected = [[1,0,0],[0,1,0],[0,0,1]]
**Output:** 3

```

 

**Constraints:**

	- `1 <= n <= 200`

	- `n == isConnected.length`

	- `n == isConnected[i].length`

	- `isConnected[i][j]` is `1` or `0`.

	- `isConnected[i][i] == 1`

	- `isConnected[i][j] == isConnected[j][i]`

</details>

```java
public int findCircleNum(int[][] isConnected) {
    int n = isConnected.length; // Number of cities
    DSU dsu = new DSU(n); // Initialize Disjoint Set Union
    for (int i = 0; i < n; i++) // Iterate through each city
        for (int j = i + 1; j < n; j++) // Iterate through other cities (upper triangle of matrix)
            if (isConnected[i][j] == 1) dsu.union(i, j); // Merge into one province if connected
    return dsu.count; // The number of remaining disjoint sets is the number of provinces
}
```

### Redundant Connection
**Category:** Tier 2 · Reinforce
**Pattern:** DSU — first edge that closes a cycle.  **Time:** O(n·α)  **Space:** O(n).
**Approach:** Process edges in order, unioning endpoints. The first edge whose endpoints already share a root would create a cycle; in a tree-plus-one-edge graph that edge is exactly the redundant one to remove.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Redundant Connection](https://leetcode.com/problems/redundant-connection/)


In this problem, a tree is an **undirected graph** that is connected and has no cycles.

You are given a graph that started as a tree with `n` nodes labeled from `1` to `n`, with one additional edge added. The added edge has two **different** vertices chosen from `1` to `n`, and was not an edge that already existed. The graph is represented as an array `edges` of length `n` where `edges[i] = [a<sub>i</sub>, b<sub>i</sub>]` indicates that there is an edge between nodes `a<sub>i</sub>` and `b<sub>i</sub>` in the graph.

Return *an edge that can be removed so that the resulting graph is a tree of *`n`* nodes*. If there are multiple answers, return the answer that occurs last in the input.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2021/05/02/reduntant1-1-graph.jpg" style="width: 222px; height: 222px;" />

```text

**Input:** edges = [[1,2],[1,3],[2,3]]
**Output:** [2,3]

```

<strong class="example">Example 2:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2021/05/02/reduntant1-2-graph.jpg" style="width: 382px; height: 222px;" />

```text

**Input:** edges = [[1,2],[2,3],[3,4],[1,4],[1,5]]
**Output:** [1,4]

```

 

**Constraints:**

	- `n == edges.length`

	- `3 <= n <= 1000`

	- `edges[i].length == 2`

	- `1 <= a<sub>i</sub> < b<sub>i</sub> <= edges.length`

	- `a<sub>i</sub> != b<sub>i</sub>`

	- There are no repeated edges.

	- The given graph is connected.

</details>

```java
public int[] findRedundantConnection(int[][] edges) {
    DSU dsu = new DSU(edges.length + 1);   // nodes are 1-indexed; allocate enough space
    for (int[] e : edges) // Iterate through edges sequentially
        // If the two endpoints are already in the same component, this edge creates a cycle
        if (!dsu.union(e[0], e[1])) return e; // Return the redundant edge immediately
    return new int[0]; // Fallback, shouldn't be reached per problem statement
}
```

### Accounts Merge
**Category:** Tier 3 · Reference
**Pattern:** DSU over emails, grouped by owner.  **Time:** O(N·α + sorting)  **Space:** O(N).
**Approach:** Assign each email an id and union all emails within the same account (they belong to one person). Map every email to its account name. Group emails by DSU root, sort each group, and prepend the owner name.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Accounts Merge](https://leetcode.com/problems/accounts-merge/)


Given a list of `accounts` where each element `accounts[i]` is a list of strings, where the first element `accounts[i][0]` is a name, and the rest of the elements are **emails** representing emails of the account.

Now, we would like to merge these accounts. Two accounts definitely belong to the same person if there is some common email to both accounts. Note that even if two accounts have the same name, they may belong to different people as people could have the same name. A person can have any number of accounts initially, but all of their accounts definitely have the same name.

After merging the accounts, return the accounts in the following format: the first element of each account is the name, and the rest of the elements are emails **in sorted order**. The accounts themselves can be returned in **any order**.

 

<strong class="example">Example 1:</strong>

```text

**Input:** accounts = [["John","johnsmith@mail.com","john_newyork@mail.com"],["John","johnsmith@mail.com","john00@mail.com"],["Mary","mary@mail.com"],["John","johnnybravo@mail.com"]]
**Output:** [["John","john00@mail.com","john_newyork@mail.com","johnsmith@mail.com"],["Mary","mary@mail.com"],["John","johnnybravo@mail.com"]]
**Explanation:**
The first and second John's are the same person as they have the common email "johnsmith@mail.com".
The third John and Mary are different people as none of their email addresses are used by other accounts.
We could return these lists in any order, for example the answer [['Mary', 'mary@mail.com'], ['John', 'johnnybravo@mail.com'], 
['John', 'john00@mail.com', 'john_newyork@mail.com', 'johnsmith@mail.com']] would still be accepted.

```

<strong class="example">Example 2:</strong>

```text

**Input:** accounts = [["Gabe","Gabe0@m.co","Gabe3@m.co","Gabe1@m.co"],["Kevin","Kevin3@m.co","Kevin5@m.co","Kevin0@m.co"],["Ethan","Ethan5@m.co","Ethan4@m.co","Ethan0@m.co"],["Hanzo","Hanzo3@m.co","Hanzo1@m.co","Hanzo0@m.co"],["Fern","Fern5@m.co","Fern1@m.co","Fern0@m.co"]]
**Output:** [["Ethan","Ethan0@m.co","Ethan4@m.co","Ethan5@m.co"],["Gabe","Gabe0@m.co","Gabe1@m.co","Gabe3@m.co"],["Hanzo","Hanzo0@m.co","Hanzo1@m.co","Hanzo3@m.co"],["Kevin","Kevin0@m.co","Kevin3@m.co","Kevin5@m.co"],["Fern","Fern0@m.co","Fern1@m.co","Fern5@m.co"]]

```

 

**Constraints:**

	- `1 <= accounts.length <= 1000`

	- `2 <= accounts[i].length <= 10`

	- `1 <= accounts[i][j].length <= 30`

	- `accounts[i][0]` consists of English letters.

	- `accounts[i][j] (for j > 0)` is a valid email.

</details>

```java
public List<List<String>> accountsMerge(List<List<String>> accounts) {
    Map<String, Integer> id = new HashMap<>(); // Maps an email to a unique integer ID
    Map<String, String> owner = new HashMap<>(); // Maps an email to its owner's name
    int n = 0; // Counter to generate unique IDs
    for (List<String> acc : accounts) { // Map each unique email to an ID and owner
        for (int i = 1; i < acc.size(); i++) {
            if (!id.containsKey(acc.get(i))) { id.put(acc.get(i), n++); owner.put(acc.get(i), acc.get(0)); }
        }
    }
    DSU dsu = new DSU(n); // Initialize Disjoint Set Union for all unique emails
    for (List<String> acc : accounts) { // Union all emails belonging to the same account array
        for (int i = 2; i < acc.size(); i++) {
            dsu.union(id.get(acc.get(1)), id.get(acc.get(i))); // Join all emails to the first email in the array
        }
    }
    Map<Integer, TreeSet<String>> groups = new HashMap<>(); // Map DSU root ID to a sorted set of emails
    for (String email : id.keySet()) { // Group emails by their root ID
        groups.computeIfAbsent(dsu.find(id.get(email)), k -> new TreeSet<>()).add(email);
    }
    List<List<String>> res = new ArrayList<>(); // Resulting merged list
    for (TreeSet<String> emails : groups.values()) { // Format the output per group
        List<String> row = new ArrayList<>();
        row.add(owner.get(emails.first())); // Get the owner name of the first email (all share the same owner)
        row.addAll(emails); // Append sorted emails
        res.add(row); // Add the merged account to the result
    }
    return res; // Return grouped and sorted accounts
}
```

### Graph Valid Tree
**Category:** Tier 3 · Reference
**Pattern:** DSU — connectivity + acyclicity.  **Time:** O(n·α)  **Space:** O(n).
**Approach:** A graph on n nodes is a tree iff it has exactly n-1 edges and is fully connected with no cycles. Union each edge; if any edge connects two already-joined nodes there is a cycle (false). Finally confirm a single component.


<!-- Problem Statement not automatically found -->

```java
public boolean validTree(int n, int[][] edges) {
    if (edges.length != n - 1) return false;        // tree needs exactly n-1 edges: if not, it's not a tree
    DSU dsu = new DSU(n); // Initialize Disjoint Set Union
    for (int[] e : edges) // Iterate through each edge
        if (!dsu.union(e[0], e[1])) return false;    // cycle detected: if endpoints share root, adding edge makes a cycle
    return dsu.count == 1; // It's a valid tree if exactly 1 connected component remains
}
```

---

## Weighted Shortest Path

### Network Delay Time (Dijkstra)
**Category:** ⭐ Tier 1 · Core
**Pattern:** Dijkstra with a min-heap.  **Time:** O(E log V)  **Space:** O(V + E).
**Approach:** Find shortest times from source `k` to all nodes, then return the maximum (when the last node receives the signal). Use a priority queue keyed by accumulated time, relaxing edges and skipping stale entries; if any node is unreachable, return -1.


<!-- Problem Statement not automatically found -->

```java
public int networkDelayTime(int[][] times, int n, int k) {
    List<List<int[]>> adj = new ArrayList<>(); // Adjacency list storing pairs of {neighbor, travel_time}
    for (int i = 0; i <= n; i++) adj.add(new ArrayList<>()); // Initialize lists for 1-indexed nodes
    for (int[] t : times) adj.get(t[0]).add(new int[]{t[1], t[2]}); // Build the directed, weighted graph
    int[] dist = new int[n + 1]; // Array storing shortest time to each node
    Arrays.fill(dist, Integer.MAX_VALUE); // Initialize to infinity
    dist[k] = 0; // Distance to the start node is 0
    PriorityQueue<int[]> pq = new PriorityQueue<>((a, b) -> a[1] - b[1]);  // Min-heap ordered by accumulated distance: {node, dist}
    pq.offer(new int[]{k, 0}); // Push the start node to the queue
    while (!pq.isEmpty()) { // Dijkstra's algorithm loop
        int[] cur = pq.poll(); // Extract the node with the minimum current distance
        if (cur[1] > dist[cur[0]]) continue;                              // stale: if we found a shorter path earlier, ignore this entry
        for (int[] e : adj.get(cur[0])) { // Iterate over all outgoing edges from current node
            int nd = cur[1] + e[1]; // Calculate new distance through current node
            if (nd < dist[e[0]]) { dist[e[0]] = nd; pq.offer(new int[]{e[0], nd}); } // If shorter, relax the edge and add to PQ
        }
    }
    int max = 0; // Variable to find the maximum shortest distance
    for (int i = 1; i <= n; i++) { // Iterate over all nodes
        if (dist[i] == Integer.MAX_VALUE) return -1; // If any node is unreachable (dist is infinity), return -1
        max = Math.max(max, dist[i]); // Keep track of the longest shortest path
    }
    return max; // Return the time when the last node is reached
}
```

### Cheapest Flights Within K Stops (Bellman-Ford)
**Category:** Tier 2 · Reinforce
**Pattern:** Bounded Bellman-Ford (≤ K+1 edges).  **Time:** O(K·E)  **Space:** O(V).
**Approach:** Relax all edges exactly K+1 times (K stops means at most K+1 flights). To prevent using updates made in the same round, relax from a snapshot of the previous round's distances. The result for `dst` is the cheapest such bounded-hop price.


<!-- Problem Statement not automatically found -->

```java
public int findCheapestPrice(int n, int[][] flights, int src, int dst, int k) {
    int[] dist = new int[n]; // Array tracking minimum cost to reach each node
    Arrays.fill(dist, Integer.MAX_VALUE); // Initialize all costs to infinity
    dist[src] = 0; // Cost to reach starting city is 0
    for (int i = 0; i <= k; i++) { // Run Bellman-Ford exactly k + 1 times (max allowed flights)
        int[] prev = dist.clone();                       // snapshot: Use distances from previous round to enforce hop limits
        for (int[] f : flights) { // Iterate over all available flights
            if (prev[f[0]] == Integer.MAX_VALUE) continue; // Skip if source city hasn't been reached yet
            dist[f[1]] = Math.min(dist[f[1]], prev[f[0]] + f[2]); // Update destination city cost if path through source is cheaper
        }
    }
    return dist[dst] == Integer.MAX_VALUE ? -1 : dist[dst]; // Return cost or -1 if unreachable within k stops
}
```

### Path with Minimum Effort (Dijkstra-style)
**Category:** Tier 3 · Reference
**Pattern:** Dijkstra where cost = max edge on path (minimax).  **Time:** O(m·n·log(m·n))  **Space:** O(m·n).
**Approach:** Define a path's effort as the maximum absolute height difference along it; we want the path minimizing that maximum. Run a Dijkstra variant where the "distance" of a cell is the smallest possible max-difference to reach it, popping the lowest-effort cell first.


<!-- Problem Statement not automatically found -->

```java
public int minimumEffortPath(int[][] heights) {
    int m = heights.length, n = heights[0].length; // Get dimensions of the height grid
    int[][] effort = new int[m][n]; // Grid storing minimum max-effort to reach each cell
    for (int[] row : effort) Arrays.fill(row, Integer.MAX_VALUE); // Initialize to infinity
    effort[0][0] = 0; // Starting cell requires 0 effort
    PriorityQueue<int[]> pq = new PriorityQueue<>((a, b) -> a[0] - b[0]); // Min-heap ordered by accumulated effort: {effort, r, c}
    pq.offer(new int[]{0, 0, 0}); // Start Dijkstra from top-left cell
    int[][] dirs = {{1,0},{-1,0},{0,1},{0,-1}}; // 4 directional movements
    while (!pq.isEmpty()) { // Process cells in order of their effort
        int[] cur = pq.poll(); // Extract the cell with the lowest effort
        int e = cur[0], r = cur[1], c = cur[2]; // Unpack effort, row, column
        if (r == m - 1 && c == n - 1) return e; // Early exit: reaching target with minimum effort
        if (e > effort[r][c]) continue; // Ignore stale, sub-optimal paths
        for (int[] d : dirs) { // Check all neighbors
            int nr = r + d[0], nc = c + d[1]; // Compute neighbor coordinates
            if (nr >= 0 && nr < m && nc >= 0 && nc < n) { // If neighbor is in bounds
                int ne = Math.max(e, Math.abs(heights[nr][nc] - heights[r][c])); // New effort is max of current path effort and this step's elevation difference
                if (ne < effort[nr][nc]) { effort[nr][nc] = ne; pq.offer(new int[]{ne, nr, nc}); } // If we found a lower effort path, relax and enqueue
            }
        }
    }
    return 0; // Fallback
}
```

### Floyd-Warshall template
**Category:** 🧩 Template
**Pattern:** All-pairs shortest path via DP.  **Time:** O(V³)  **Space:** O(V²).
**Approach:** For every intermediate node `k`, try improving every pair (i, j) by routing through k. After processing all k, `dist[i][j]` holds the shortest distance. Handles negative edges (no negative cycles); use a large sentinel for "no edge" and guard against overflow.


<!-- Problem Statement not automatically found -->

```java
void floydWarshall(int[][] dist) {   // dist[i][j] init: 0 on diagonal, edge weight, else INF
    int n = dist.length; // Number of nodes in the graph
    final int INF = Integer.MAX_VALUE / 2;   // avoid overflow on addition: use a safe infinity
    for (int k = 0; k < n; k++) // Outermost loop: intermediate node k
        for (int i = 0; i < n; i++) // Source node i
            for (int j = 0; j < n; j++) // Destination node j
                if (dist[i][k] + dist[k][j] < dist[i][j]) // If routing through k is cheaper
                    dist[i][j] = dist[i][k] + dist[k][j]; // Update shortest path distance
}
```

---

## Minimum Spanning Tree

### Min Cost to Connect All Points — Kruskal
**Category:** Tier 2 · Reinforce
**Pattern:** Sort edges, union greedily.  **Time:** O(n² log n)  **Space:** O(n²).
**Approach:** Build all pairwise Manhattan-distance edges, sort ascending, and add an edge to the MST only if it joins two different components (DSU prevents cycles). Stop once n-1 edges are chosen.


<!-- Problem Statement not automatically found -->

```java
public int minCostConnectPoints(int[][] points) {
    int n = points.length; // Number of points to connect
    List<int[]> edges = new ArrayList<>();          // {weight, i, j}: Edge list to store all possible connections
    for (int i = 0; i < n; i++) // Build a complete graph
        for (int j = i + 1; j < n; j++) { // Avoid duplicate edges and self-loops
            int w = Math.abs(points[i][0] - points[j][0]) + Math.abs(points[i][1] - points[j][1]); // Calculate Manhattan distance as weight
            edges.add(new int[]{w, i, j}); // Add the edge representation
        }
    edges.sort((a, b) -> a[0] - b[0]); // Sort edges globally by ascending weight
    DSU dsu = new DSU(n); // Initialize Disjoint Set Union to track components
    int cost = 0, used = 0; // Variables to track total MST cost and number of edges selected
    for (int[] e : edges) { // Process edges in greedy order (lowest weight first)
        if (dsu.union(e[1], e[2])) { // If nodes belong to different components, adding the edge won't form a cycle
            cost += e[0]; // Add edge weight to total cost
            if (++used == n - 1) break; // Optimization: MST requires exactly n-1 edges; break early
        }
    }
    return cost; // Return the MST cost
}
```

### Min Cost to Connect All Points — Prim
**Category:** Tier 2 · Reinforce
**Pattern:** Grow MST from one node with a min-heap.  **Time:** O(n² log n)  **Space:** O(n).
**Approach:** Start from any point; repeatedly pull the cheapest edge connecting the tree to an unvisited point, add its weight, and push that point's edges to all unvisited points. Each point is finalized once; finish when all n are in the tree.


<!-- Problem Statement not automatically found -->

```java
public int minCostConnectPointsPrim(int[][] points) {
    int n = points.length; // Number of points
    boolean[] inMST = new boolean[n]; // Track which points are already included in the MST
    PriorityQueue<int[]> pq = new PriorityQueue<>((a, b) -> a[0] - b[0]); // Min-heap based on edge cost: {cost, node_index}
    pq.offer(new int[]{0, 0}); // Start with node 0, cost to reach it is 0
    int cost = 0, count = 0; // Total accumulated cost and number of points added to MST
    while (count < n) { // Repeat until all n points are in the MST
        int[] cur = pq.poll(); // Extract the lowest cost edge available
        int w = cur[0], u = cur[1]; // Unpack cost and target node
        if (inMST[u]) continue; // Skip if the node is already in the MST (stale edge)
        inMST[u] = true; cost += w; count++; // Mark as included, add to total cost, and increment count
        for (int v = 0; v < n; v++) { // Look at all possible next nodes
            if (!inMST[v]) { // If the node is not yet in the MST
                int d = Math.abs(points[u][0] - points[v][0]) + Math.abs(points[u][1] - points[v][1]); // Calculate Manhattan distance
                pq.offer(new int[]{d, v}); // Add this potential edge to the priority queue
            }
        }
    }
    return cost; // Return the total MST cost
}
```

---

## Other

### Is Graph Bipartite?
**Category:** Tier 3 · Reference
**Pattern:** 2-coloring via BFS/DFS.  **Time:** O(V + E)  **Space:** O(V).
**Approach:** Try to color the graph with two colors so that no edge joins same-colored nodes. BFS each uncolored component, assigning the opposite color to each neighbor; a conflict (a neighbor already has the same color) proves it is not bipartite.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Is Graph Bipartite?](https://leetcode.com/problems/is-graph-bipartite/)


There is an **undirected** graph with `n` nodes, where each node is numbered between `0` and `n - 1`. You are given a 2D array `graph`, where `graph[u]` is an array of nodes that node `u` is adjacent to. More formally, for each `v` in `graph[u]`, there is an undirected edge between node `u` and node `v`. The graph has the following properties:

	- There are no self-edges (`graph[u]` does not contain `u`).

	- There are no parallel edges (`graph[u]` does not contain duplicate values).

	- If `v` is in `graph[u]`, then `u` is in `graph[v]` (the graph is undirected).

	- The graph may not be connected, meaning there may be two nodes `u` and `v` such that there is no path between them.

A graph is **bipartite** if the nodes can be partitioned into two independent sets `A` and `B` such that **every** edge in the graph connects a node in set `A` and a node in set `B`.

Return `true`* if and only if it is **bipartite***.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2020/10/21/bi2.jpg" style="width: 222px; height: 222px;" />

```text

**Input:** graph = [[1,2,3],[0,2],[0,1,3],[0,2]]
**Output:** false
**Explanation:** There is no way to partition the nodes into two independent sets such that every edge connects a node in one and a node in the other.
```

<strong class="example">Example 2:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2020/10/21/bi1.jpg" style="width: 222px; height: 222px;" />

```text

**Input:** graph = [[1,3],[0,2],[1,3],[0,2]]
**Output:** true
**Explanation:** We can partition the nodes into two sets: {0, 2} and {1, 3}.
```

 

**Constraints:**

	- `graph.length == n`

	- `1 <= n <= 100`

	- `0 <= graph[u].length < n`

	- `0 <= graph[u][i] <= n - 1`

	- `graph[u]` does not contain `u`.

	- All the values of `graph[u]` are **unique**.

	- If `graph[u]` contains `v`, then `graph[v]` contains `u`.

</details>

```java
public boolean isBipartite(int[][] graph) {
    int n = graph.length; // Number of nodes in the graph
    int[] color = new int[n];           // 0 = uncolored, 1 / -1 = colors: array to store the color of each node
    for (int i = 0; i < n; i++) { // Check each node (graph might be disconnected)
        if (color[i] != 0) continue; // Skip if the node is already colored from a previous component traversal
        Queue<Integer> q = new ArrayDeque<>(); // BFS queue
        q.offer(i); color[i] = 1; // Start a new component coloring with node i assigned color 1
        while (!q.isEmpty()) { // Process the BFS queue
            int u = q.poll(); // Get the next node
            for (int v : graph[u]) { // Iterate through its neighbors
                if (color[v] == color[u]) return false; // If a neighbor has the same color, the graph cannot be bipartite
                if (color[v] == 0) { color[v] = -color[u]; q.offer(v); } // If uncolored, assign it the opposite color and enqueue
            }
        }
    }
    return true; // Successfully colored all components with 2 colors without conflict
}
```

### Reconstruct Itinerary (Hierholzer / Eulerian path)
**Category:** Tier 3 · Reference
**Pattern:** Hierholzer's algorithm for an Eulerian path.  **Time:** O(E log E)  **Space:** O(E).
**Approach:** Every ticket is a directed edge; we need an Eulerian path starting at "JFK" using each edge once. Keep destinations sorted (lexical order) per origin. DFS greedily, and on backtracking prepend the node to the route — this yields the valid itinerary in reverse, so reverse it at the end.


<!-- Problem Statement not automatically found -->

```java
public List<String> findItinerary(List<List<String>> tickets) {
    Map<String, PriorityQueue<String>> adj = new HashMap<>(); // Adjacency list, using PriorityQueue to ensure lexical sorting of destinations
    for (List<String> t : tickets) // Iterate through all tickets
        adj.computeIfAbsent(t.get(0), k -> new PriorityQueue<>()).add(t.get(1)); // Map origin to destination in a min-heap
    LinkedList<String> route = new LinkedList<>(); // LinkedList to efficiently prepend nodes (acting as a reversed list)
    dfs("JFK", adj, route); // Start Eulerian path DFS from "JFK"
    return route; // Return the fully constructed itinerary
}

private void dfs(String node, Map<String, PriorityQueue<String>> adj, LinkedList<String> route) {
    PriorityQueue<String> dests = adj.get(node); // Get all available destinations from current node
    while (dests != null && !dests.isEmpty()) // While there are still outgoing flights
        dfs(dests.poll(), adj, route); // Greedily pick the lexicographically smallest destination and recurse
    route.addFirst(node);    // add on the way back (post-order): prepend current node after exhausting all its outgoing edges
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
