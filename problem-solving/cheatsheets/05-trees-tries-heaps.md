# 05 · Trees, Tries & Heaps

Patterns and idiomatic Java for binary trees, BSTs, tries, and heap / priority-queue problems.

```java
// Shared node definition used throughout this sheet.
public class TreeNode {
    int val; // Store the node's integer value
    TreeNode left, right; // References to the left and right child nodes
    TreeNode() {} // Default constructor for an empty node
    TreeNode(int val) { this.val = val; } // Constructor to initialize the node with a value
    TreeNode(int val, TreeNode left, TreeNode right) { // Full constructor
        this.val = val; // Set the value
        this.left = left; // Set the left child
        this.right = right; // Set the right child
    }
}
```

---

## Traversals

### Preorder / Inorder / Postorder (Recursive)
**Category:** ⭐ Tier 1 · Core
**Pattern:** DFS recursion  **Time:** O(n)  **Space:** O(h) stack
**Approach:** Visit the current node relative to its subtrees: preorder = node before children, inorder = node between children (sorted order for a BST), postorder = node after children. The only difference is where you append `root.val`. Recursion implicitly uses the call stack of depth `h`.

<!-- Problem Statement not automatically found -->

```java
List<Integer> preorder(TreeNode root) {
    List<Integer> out = new ArrayList<>(); // Initialize a list to hold the traversal result
    pre(root, out); // Call the helper method to populate the list
    return out; // Return the populated list
}
void pre(TreeNode n, List<Integer> out) {
    if (n == null) return; // Base case: if the node is null, stop recursing
    out.add(n.val); // Preorder: add the current node's value BEFORE visiting children
    pre(n.left, out); // Recursively traverse the left subtree
    pre(n.right, out); // Recursively traverse the right subtree
}
void in(TreeNode n, List<Integer> out) {
    if (n == null) return; // Base case: if the node is null, stop recursing
    in(n.left, out); // Inorder: recursively traverse the left subtree first
    out.add(n.val); // Add the current node's value in the MIDDLE
    in(n.right, out); // Recursively traverse the right subtree
}
void post(TreeNode n, List<Integer> out) {
    if (n == null) return; // Base case: if the node is null, stop recursing
    post(n.left, out); // Postorder: recursively traverse the left subtree first
    post(n.right, out); // Recursively traverse the right subtree next
    out.add(n.val); // Add the current node's value AFTER visiting both children
}
```

### Preorder / Inorder / Postorder (Iterative)
**Category:** ⭐ Tier 1 · Core
**Pattern:** Explicit stack  **Time:** O(n)  **Space:** O(h)
**Approach:** Simulate the call stack manually. Preorder pushes right then left so left pops first. Inorder walks left pushing nodes, then pops and goes right. Postorder is most cleanly done as a reversed "root-right-left" preorder.

<!-- Problem Statement not automatically found -->

```java
List<Integer> preIter(TreeNode root) {
    List<Integer> out = new ArrayList<>(); // List to store the preorder traversal
    if (root == null) return out; // Return empty list if the tree is empty
    Deque<TreeNode> st = new ArrayDeque<>(); // Stack to simulate recursion
    st.push(root); // Push the root node to start
    while (!st.isEmpty()) { // Continue until all nodes are processed
        TreeNode n = st.pop(); // Pop the top node from the stack
        out.add(n.val); // Add its value to the output list
        if (n.right != null) st.push(n.right); // Push right child FIRST so it's processed LAST (LIFO)
        if (n.left != null) st.push(n.left); // Push left child SECOND so it's processed FIRST
    }
    return out; // Return the preorder list
}
List<Integer> inIter(TreeNode root) {
    List<Integer> out = new ArrayList<>(); // List to store the inorder traversal
    Deque<TreeNode> st = new ArrayDeque<>(); // Stack for node traversal
    TreeNode cur = root; // Start with the root node
    while (cur != null || !st.isEmpty()) { // Continue if there are nodes to process or visit
        while (cur != null) { st.push(cur); cur = cur.left; } // Go as far left as possible, pushing nodes
        cur = st.pop(); // Pop the leftmost unvisited node
        out.add(cur.val); // Add its value to the output list
        cur = cur.right; // Move to the right child to process its subtree
    }
    return out; // Return the inorder list
}
List<Integer> postIter(TreeNode root) {
    LinkedList<Integer> out = new LinkedList<>(); // Use LinkedList for efficient addFirst
    if (root == null) return out; // Return empty list if the tree is empty
    Deque<TreeNode> st = new ArrayDeque<>(); // Stack for node traversal
    st.push(root); // Push the root node to start
    while (!st.isEmpty()) { // Continue until all nodes are processed
        TreeNode n = st.pop(); // Pop the top node
        out.addFirst(n.val); // Add to the FRONT of the list (reverse of root-right-left)
        if (n.left != null) st.push(n.left); // Push left child first so it's processed later
        if (n.right != null) st.push(n.right); // Push right child second so it's processed next
    }
    return out; // Return the postorder list
}
```
**Alternative:** Morris inorder traversal achieves O(1) space by threading: for each node with a left child, link the inorder-predecessor's right pointer to the current node, then undo the thread on the second visit. No stack/recursion needed.

### Level Order Traversal (BFS)
**Category:** ⭐ Tier 1 · Core
**Pattern:** BFS with queue  **Time:** O(n)  **Space:** O(n)
**Approach:** Process the tree level by level using a queue. Snapshot the queue size at the start of each level so you know exactly how many nodes belong to the current level before enqueuing their children.

<!-- Problem Statement not automatically found -->

```java
List<List<Integer>> levelOrder(TreeNode root) {
    List<List<Integer>> out = new ArrayList<>(); // Initialize the result list of levels
    if (root == null) return out; // Return empty result if the tree is empty
    Queue<TreeNode> q = new LinkedList<>(); // Queue to manage nodes per level
    q.offer(root); // Start with the root node
    while (!q.isEmpty()) { // Process until the queue is empty
        int sz = q.size(); // Number of nodes at the current level
        List<Integer> level = new ArrayList<>(); // List to store values for this level
        for (int i = 0; i < sz; i++) { // Iterate exactly `sz` times for the current level
            TreeNode n = q.poll(); // Dequeue the next node in the level
            level.add(n.val); // Add its value to the level list
            if (n.left != null) q.offer(n.left); // Enqueue left child for the next level
            if (n.right != null) q.offer(n.right); // Enqueue right child for the next level
        }
        out.add(level); // Add the completed level list to the output
    }
    return out; // Return all levels
}
```

### Zigzag Level Order
**Category:** Tier 3 · Reference
**Pattern:** BFS + direction flag  **Time:** O(n)  **Space:** O(n)
**Approach:** Standard level-order BFS, but alternate the insertion order per level. Use a `LinkedList` and `addFirst` on right-to-left levels (or reverse the list) so even levels go left-to-right and odd levels go right-to-left.

<!-- Problem Statement not automatically found -->

```java
List<List<Integer>> zigzag(TreeNode root) {
    List<List<Integer>> out = new ArrayList<>(); // Result list of zigzag levels
    if (root == null) return out; // Base case: empty tree
    Queue<TreeNode> q = new LinkedList<>(); // Queue for level-order traversal
    q.offer(root); // Start with the root
    boolean ltr = true; // Flag to track the direction: left-to-right or right-to-left
    while (!q.isEmpty()) { // Traverse levels
        int sz = q.size(); // Nodes in the current level
        LinkedList<Integer> level = new LinkedList<>(); // Use LinkedList to efficiently add at both ends
        for (int i = 0; i < sz; i++) { // Process all nodes in the current level
            TreeNode n = q.poll(); // Dequeue the next node
            if (ltr) level.addLast(n.val); // If left-to-right, append to the end
            else     level.addFirst(n.val); // If right-to-left, prepend to the start
            if (n.left != null) q.offer(n.left); // Enqueue children for the next level
            if (n.right != null) q.offer(n.right); // Keep normal order in the queue
        }
        out.add(level); // Add the current level to the result
        ltr = !ltr; // Toggle the direction for the next level
    }
    return out; // Return the zigzag traversal
}
```

### Binary Tree Right Side View
**Category:** Tier 2 · Reinforce
**Pattern:** BFS, last per level  **Time:** O(n)  **Space:** O(n)
**Approach:** Do a level-order BFS and record only the last node of each level (the rightmost visible one). Alternatively DFS visiting right before left and capture the first node seen at each depth.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Binary Tree Right Side View](https://leetcode.com/problems/binary-tree-right-side-view/)


Given the `root` of a binary tree, imagine yourself standing on the **right side** of it, return *the values of the nodes you can see ordered from top to bottom*.

 

<strong class="example">Example 1:</strong>

<div class="example-block">

**Input:** <span class="example-io">root = [1,2,3,null,5,null,4]</span>

**Output:** <span class="example-io">[1,3,4]</span>

**Explanation:**

<img alt="" src="https://assets.leetcode.com/uploads/2024/11/24/tmpd5jn43fs-1.png" style="width: 400px; height: 207px;" />
</div>

<strong class="example">Example 2:</strong>

<div class="example-block">

**Input:** <span class="example-io">root = [1,2,3,4,null,null,null,5]</span>

**Output:** <span class="example-io">[1,3,4,5]</span>

**Explanation:**

<img alt="" src="https://assets.leetcode.com/uploads/2024/11/24/tmpkpe40xeh-1.png" style="width: 400px; height: 214px;" />
</div>

<strong class="example">Example 3:</strong>

<div class="example-block">

**Input:** <span class="example-io">root = [1,null,3]</span>

**Output:** <span class="example-io">[1,3]</span>
</div>

<strong class="example">Example 4:</strong>

<div class="example-block">

**Input:** <span class="example-io">root = []</span>

**Output:** <span class="example-io">[]</span>
</div>

 

**Constraints:**

	- The number of nodes in the tree is in the range `[0, 100]`.

	- `-100 <= Node.val <= 100`

</details>

```java
List<Integer> rightSideView(TreeNode root) {
    List<Integer> out = new ArrayList<>(); // List to store the rightmost values
    if (root == null) return out; // Base case: empty tree
    Queue<TreeNode> q = new LinkedList<>(); // Queue for level-order traversal
    q.offer(root); // Enqueue the root node
    while (!q.isEmpty()) { // Process each level
        int sz = q.size(); // Get the size of the current level
        for (int i = 0; i < sz; i++) { // Iterate through the nodes in this level
            TreeNode n = q.poll(); // Dequeue a node
            if (i == sz - 1) out.add(n.val); // If it's the last node in the level, add it to output
            if (n.left != null) q.offer(n.left); // Add left child to the queue
            if (n.right != null) q.offer(n.right); // Add right child to the queue
        }
    }
    return out; // Return the right side view
}
```
**Alternative:** DFS visiting right child first; add `node.val` when `depth == out.size()`.

---

## Tree DFS / Divide & Conquer

### Maximum Depth
**Category:** ⭐ Tier 1 · Core
**Pattern:** DFS post-order  **Time:** O(n)  **Space:** O(h)
**Approach:** The depth of a node is 1 plus the max depth of its two subtrees. Base case: a null node has depth 0. Classic divide-and-conquer.

<!-- Problem Statement not automatically found -->

```java
int maxDepth(TreeNode root) {
    if (root == null) return 0; // Base case: if the node is null, its depth is 0
    return 1 + Math.max(maxDepth(root.left), maxDepth(root.right)); // Add 1 to the max depth of the subtrees
}
```

### Diameter of Binary Tree
**Category:** Tier 2 · Reinforce
**Pattern:** DFS, return height + track answer  **Time:** O(n)  **Space:** O(h)
**Approach:** The diameter through a node equals leftHeight + rightHeight. Compute height bottom-up while updating a global maximum of left+right path lengths. The recursive call returns height so the parent can reuse it.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Diameter of Binary Tree](https://leetcode.com/problems/diameter-of-binary-tree/)


Given the `root` of a binary tree, return *the length of the **diameter** of the tree*.

The **diameter** of a binary tree is the **length** of the longest path between any two nodes in a tree. This path may or may not pass through the `root`.

The **length** of a path between two nodes is represented by the number of edges between them.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2021/03/06/diamtree.jpg" style="width: 292px; height: 302px;" />

```text

**Input:** root = [1,2,3,4,5]
**Output:** 3
**Explanation:** 3 is the length of the path [4,2,1,3] or [5,2,1,3].

```

<strong class="example">Example 2:</strong>

```text

**Input:** root = [1,2]
**Output:** 1

```

 

**Constraints:**

	- The number of nodes in the tree is in the range `[1, 10<sup>4</sup>]`.

	- `-100 <= Node.val <= 100`

</details>

```java
int best = 0; // Global variable to track the maximum diameter found
int diameterOfBinaryTree(TreeNode root) {
    height(root); // Call the helper to compute heights and update the diameter
    return best; // Return the maximum diameter
}
int height(TreeNode n) {
    if (n == null) return 0; // Base case: null node has a height of 0
    int l = height(n.left), r = height(n.right); // Recursively find the height of left and right subtrees
    best = Math.max(best, l + r); // Update the global diameter if the path through this node is larger
    return 1 + Math.max(l, r); // Return the height of the tree rooted at this node
}
```

### Balanced Binary Tree
**Category:** Tier 3 · Reference
**Pattern:** DFS, height with sentinel  **Time:** O(n)  **Space:** O(h)
**Approach:** A tree is balanced if every node's subtree heights differ by at most 1. Compute height bottom-up and return -1 as a sentinel the moment any subtree is unbalanced, short-circuiting the rest.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Balanced Binary Tree](https://leetcode.com/problems/balanced-binary-tree/)


Given a binary tree, determine if it is <span data-keyword="height-balanced">**height-balanced**</span>.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2020/10/06/balance_1.jpg" style="width: 342px; height: 221px;" />

```text

**Input:** root = [3,9,20,null,null,15,7]
**Output:** true

```

<strong class="example">Example 2:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2020/10/06/balance_2.jpg" style="width: 452px; height: 301px;" />

```text

**Input:** root = [1,2,2,3,3,null,null,4,4]
**Output:** false

```

<strong class="example">Example 3:</strong>

```text

**Input:** root = []
**Output:** true

```

 

**Constraints:**

	- The number of nodes in the tree is in the range `[0, 5000]`.

	- `-10<sup>4</sup> <= Node.val <= 10<sup>4</sup>`

</details>

```java
boolean isBalanced(TreeNode root) {
    return check(root) != -1; // If check returns -1, it's unbalanced; otherwise, it's balanced
}
int check(TreeNode n) {
    if (n == null) return 0; // Base case: an empty tree has height 0
    int l = check(n.left); // Get the height of the left subtree
    if (l == -1) return -1; // If the left subtree is unbalanced, propagate the failure
    int r = check(n.right); // Get the height of the right subtree
    if (r == -1) return -1; // If the right subtree is unbalanced, propagate the failure
    if (Math.abs(l - r) > 1) return -1; // If heights differ by more than 1, this node is unbalanced
    return 1 + Math.max(l, r); // Return the actual height of this node if balanced
}
```

### Path Sum
**Category:** Tier 3 · Reference
**Pattern:** DFS root-to-leaf  **Time:** O(n)  **Space:** O(h)
**Approach:** Subtract the current node value from the target as you descend. At a leaf, success means the remaining target equals the leaf value. Recurse on both children with the reduced target.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Path Sum](https://leetcode.com/problems/path-sum/)


Given the `root` of a binary tree and an integer `targetSum`, return `true` if the tree has a **root-to-leaf** path such that adding up all the values along the path equals `targetSum`.

A **leaf** is a node with no children.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2021/01/18/pathsum1.jpg" style="width: 500px; height: 356px;" />

```text

**Input:** root = [5,4,8,11,null,13,4,7,2,null,null,null,1], targetSum = 22
**Output:** true
**Explanation:** The root-to-leaf path with the target sum is shown.

```

<strong class="example">Example 2:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2021/01/18/pathsum2.jpg" />

```text

**Input:** root = [1,2,3], targetSum = 5
**Output:** false
**Explanation:** There are two root-to-leaf paths in the tree:
(1 --> 2): The sum is 3.
(1 --> 3): The sum is 4.
There is no root-to-leaf path with sum = 5.

```

<strong class="example">Example 3:</strong>

```text

**Input:** root = [], targetSum = 0
**Output:** false
**Explanation:** Since the tree is empty, there are no root-to-leaf paths.

```

 

**Constraints:**

	- The number of nodes in the tree is in the range `[0, 5000]`.

	- `-1000 <= Node.val <= 1000`

	- `-1000 <= targetSum <= 1000`

</details>

```java
boolean hasPathSum(TreeNode root, int target) {
    if (root == null) return false; // Base case: an empty tree can't have a path sum
    if (root.left == null && root.right == null) return target == root.val; // Leaf node check: does the value match the remaining target?
    int rem = target - root.val; // Calculate the remaining sum needed for the children
    return hasPathSum(root.left, rem) || hasPathSum(root.right, rem); // Recurse on both children looking for the remaining sum
}
```

### Path Sum II
**Category:** Tier 3 · Reference
**Pattern:** DFS + backtracking  **Time:** O(n)  **Space:** O(h + #paths)
**Approach:** Collect every root-to-leaf path that sums to target. Maintain a running path list; add the node on entry and remove it on exit (backtrack). When a leaf hits the target, snapshot a copy of the path.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Path Sum II](https://leetcode.com/problems/path-sum-ii/)


Given the `root` of a binary tree and an integer `targetSum`, return *all **root-to-leaf** paths where the sum of the node values in the path equals *`targetSum`*. Each path should be returned as a list of the node **values**, not node references*.

A **root-to-leaf** path is a path starting from the root and ending at any leaf node. A **leaf** is a node with no children.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2021/01/18/pathsumii1.jpg" style="width: 500px; height: 356px;" />

```text

**Input:** root = [5,4,8,11,null,13,4,7,2,null,null,5,1], targetSum = 22
**Output:** [[5,4,11,2],[5,8,4,5]]
**Explanation:** There are two paths whose sum equals targetSum:
5 + 4 + 11 + 2 = 22
5 + 8 + 4 + 5 = 22

```

<strong class="example">Example 2:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2021/01/18/pathsum2.jpg" style="width: 212px; height: 181px;" />

```text

**Input:** root = [1,2,3], targetSum = 5
**Output:** []

```

<strong class="example">Example 3:</strong>

```text

**Input:** root = [1,2], targetSum = 0
**Output:** []

```

 

**Constraints:**

	- The number of nodes in the tree is in the range `[0, 5000]`.

	- `-1000 <= Node.val <= 1000`

	- `-1000 <= targetSum <= 1000`

</details>

```java
List<List<Integer>> pathSum(TreeNode root, int target) {
    List<List<Integer>> out = new ArrayList<>(); // Result list of paths
    dfs(root, target, new ArrayList<>(), out); // Call DFS to populate the list
    return out; // Return the valid paths
}
void dfs(TreeNode n, int rem, List<Integer> path, List<List<Integer>> out) {
    if (n == null) return; // Base case: stop at null nodes
    path.add(n.val); // Add the current node to the path
    if (n.left == null && n.right == null && rem == n.val) { // If it's a leaf and the target is met
        out.add(new ArrayList<>(path)); // Add a copy of the path to the result
    } else { // Otherwise, continue exploring
        dfs(n.left,  rem - n.val, path, out); // Traverse left subtree with reduced target
        dfs(n.right, rem - n.val, path, out); // Traverse right subtree with reduced target
    }
    path.remove(path.size() - 1); // Backtrack: remove the current node before returning
}
```

### Path Sum III
**Category:** Tier 3 · Reference
**Pattern:** Prefix-sum hashmap  **Time:** O(n)  **Space:** O(h)
**Approach:** Count downward paths (not necessarily root-to-leaf) summing to target. Track the running prefix sum from root and a map of prefix-sum counts; the number of valid paths ending at the current node is `count(curr - target)`. Add/remove the current prefix as you enter/leave a node.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Path Sum III](https://leetcode.com/problems/path-sum-iii/)


Given the `root` of a binary tree and an integer `targetSum`, return *the number of paths where the sum of the values along the path equals* `targetSum`.

The path does not need to start or end at the root or a leaf, but it must go downwards (i.e., traveling only from parent nodes to child nodes).

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2021/04/09/pathsum3-1-tree.jpg" style="width: 450px; height: 386px;" />

```text

**Input:** root = [10,5,-3,3,2,null,11,3,-2,null,1], targetSum = 8
**Output:** 3
**Explanation:** The paths that sum to 8 are shown.

```

<strong class="example">Example 2:</strong>

```text

**Input:** root = [5,4,8,11,null,13,4,7,2,null,null,5,1], targetSum = 22
**Output:** 3

```

 

**Constraints:**

	- The number of nodes in the tree is in the range `[0, 1000]`.

	- `-10<sup>9</sup> <= Node.val <= 10<sup>9</sup>`

	- `-1000 <= targetSum <= 1000`

</details>

```java
int pathSumIII(TreeNode root, int target) {
    Map<Long, Integer> seen = new HashMap<>(); // Store the prefix sums and their frequencies
    seen.put(0L, 1); // Base case: a prefix sum of 0 has been seen once
    return dfs(root, 0L, target, seen); // Start DFS from the root
}
int dfs(TreeNode n, long curr, int target, Map<Long, Integer> seen) {
    if (n == null) return 0; // Base case: empty node contributes 0 paths
    curr += n.val; // Update the running prefix sum
    int res = seen.getOrDefault(curr - target, 0); // Check if (curr - target) exists in seen map
    seen.merge(curr, 1, Integer::sum); // Add current prefix sum to the map
    res += dfs(n.left, curr, target, seen) + dfs(n.right, curr, target, seen); // Recurse on children
    seen.merge(curr, -1, Integer::sum); // Backtrack: remove current sum from map before returning
    return res; // Return total valid paths found from this subtree
}
```

### Lowest Common Ancestor (Binary Tree)
**Category:** ⭐ Tier 1 · Core
**Pattern:** DFS post-order  **Time:** O(n)  **Space:** O(h)
**Approach:** If the current node is null or equals p or q, return it. Recurse on both sides; if both return non-null, the current node is the split point and thus the LCA. Otherwise propagate whichever side found something.

<!-- Problem Statement not automatically found -->

```java
TreeNode lca(TreeNode root, TreeNode p, TreeNode q) {
    if (root == null || root == p || root == q) return root; // Base case: found p, q, or reached a leaf
    TreeNode l = lca(root.left, p, q); // Look for LCA in the left subtree
    TreeNode r = lca(root.right, p, q); // Look for LCA in the right subtree
    if (l != null && r != null) return root; // If both subtrees returned a node, the current root is the LCA
    return l != null ? l : r; // Otherwise, return whichever subtree found a node
}
```

### Binary Tree Maximum Path Sum
**Category:** Tier 2 · Reinforce
**Pattern:** DFS, gain vs. global  **Time:** O(n)  **Space:** O(h)
**Approach:** For each node, the best "gain" it can contribute upward is its value plus the larger of its children's gains (clamped at 0 to drop negatives). The best path *through* a node is value + leftGain + rightGain; update a global max with that, but return only the single-branch gain to the parent.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Binary Tree Maximum Path Sum](https://leetcode.com/problems/binary-tree-maximum-path-sum/)


A **path** in a binary tree is a sequence of nodes where each pair of adjacent nodes in the sequence has an edge connecting them. A node can only appear in the sequence **at most once**. Note that the path does not need to pass through the root.

The **path sum** of a path is the sum of the node's values in the path.

Given the `root` of a binary tree, return *the maximum **path sum** of any **non-empty** path*.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2020/10/13/exx1.jpg" style="width: 322px; height: 182px;" />

```text

**Input:** root = [1,2,3]
**Output:** 6
**Explanation:** The optimal path is 2 -> 1 -> 3 with a path sum of 2 + 1 + 3 = 6.

```

<strong class="example">Example 2:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2020/10/13/exx2.jpg" />

```text

**Input:** root = [-10,9,20,null,null,15,7]
**Output:** 42
**Explanation:** The optimal path is 15 -> 20 -> 7 with a path sum of 15 + 20 + 7 = 42.

```

 

**Constraints:**

	- The number of nodes in the tree is in the range `[1, 3 * 10<sup>4</sup>]`.

	- `-1000 <= Node.val <= 1000`

</details>

```java
int maxSum = Integer.MIN_VALUE; // Global variable to store the maximum path sum
int maxPathSum(TreeNode root) {
    gain(root); // Calculate the max gain for the tree
    return maxSum; // Return the global maximum
}
int gain(TreeNode n) {
    if (n == null) return 0; // Base case: null nodes contribute 0
    int l = Math.max(gain(n.left), 0); // Max gain from left subtree, ignoring negative paths
    int r = Math.max(gain(n.right), 0); // Max gain from right subtree, ignoring negative paths
    maxSum = Math.max(maxSum, n.val + l + r); // Update the global max path sum that passes through this node
    return n.val + Math.max(l, r); // Return the max gain this node can contribute to its parent
}
```

### Invert Binary Tree
**Category:** Tier 2 · Reinforce
**Pattern:** DFS swap  **Time:** O(n)  **Space:** O(h)
**Approach:** Swap each node's left and right children, then recurse. Works top-down or bottom-up; either way every node's children are mirrored.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Invert Binary Tree](https://leetcode.com/problems/invert-binary-tree/)


Given the `root` of a binary tree, invert the tree, and return *its root*.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2021/03/14/invert1-tree.jpg" style="width: 500px; height: 165px;" />

```text

**Input:** root = [4,2,7,1,3,6,9]
**Output:** [4,7,2,9,6,3,1]

```

<strong class="example">Example 2:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2021/03/14/invert2-tree.jpg" style="width: 500px; height: 120px;" />

```text

**Input:** root = [2,1,3]
**Output:** [2,3,1]

```

<strong class="example">Example 3:</strong>

```text

**Input:** root = []
**Output:** []

```

 

**Constraints:**

	- The number of nodes in the tree is in the range `[0, 100]`.

	- `-100 <= Node.val <= 100`

</details>

```java
TreeNode invertTree(TreeNode root) {
    if (root == null) return null; // Base case: an empty tree is already inverted
    TreeNode tmp = root.left; // Temporarily store the left child
    root.left = invertTree(root.right); // Assign inverted right subtree to the left
    root.right = invertTree(tmp); // Assign inverted left subtree (from tmp) to the right
    return root; // Return the modified root
}
```

### Symmetric Tree
**Category:** Tier 3 · Reference
**Pattern:** DFS paired comparison  **Time:** O(n)  **Space:** O(h)
**Approach:** A tree mirrors itself if the left subtree is the mirror of the right subtree. Compare two nodes simultaneously: their values must match, and the outer pair (a.left vs b.right) and inner pair (a.right vs b.left) must each be mirrors.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Symmetric Tree](https://leetcode.com/problems/symmetric-tree/)


Given the `root` of a binary tree, *check whether it is a mirror of itself* (i.e., symmetric around its center).

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2021/02/19/symtree1.jpg" style="width: 354px; height: 291px;" />

```text

**Input:** root = [1,2,2,3,4,4,3]
**Output:** true

```

<strong class="example">Example 2:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2021/02/19/symtree2.jpg" style="width: 308px; height: 258px;" />

```text

**Input:** root = [1,2,2,null,3,null,3]
**Output:** false

```

 

**Constraints:**

	- The number of nodes in the tree is in the range `[1, 1000]`.

	- `-100 <= Node.val <= 100`

 
**Follow up:** Could you solve it both recursively and iteratively?

</details>

```java
boolean isSymmetric(TreeNode root) {
    return root == null || mirror(root.left, root.right); // Empty tree is symmetric; otherwise check if children mirror each other
}
boolean mirror(TreeNode a, TreeNode b) {
    if (a == null || b == null) return a == b; // If either is null, both must be null to be a mirror
    // Check if current values match, and if outer children match, and inner children match
    return a.val == b.val && mirror(a.left, b.right) && mirror(a.right, b.left);
}
```

### Same Tree
**Category:** Tier 3 · Reference
**Pattern:** DFS paired comparison  **Time:** O(n)  **Space:** O(h)
**Approach:** Two trees are identical when both nodes are null, or both are non-null with equal values and identical left and right subtrees. Recurse in lockstep.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Same Tree](https://leetcode.com/problems/same-tree/)


Given the roots of two binary trees `p` and `q`, write a function to check if they are the same or not.

Two binary trees are considered the same if they are structurally identical, and the nodes have the same value.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2020/12/20/ex1.jpg" style="width: 622px; height: 182px;" />

```text

**Input:** p = [1,2,3], q = [1,2,3]
**Output:** true

```

<strong class="example">Example 2:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2020/12/20/ex2.jpg" style="width: 382px; height: 182px;" />

```text

**Input:** p = [1,2], q = [1,null,2]
**Output:** false

```

<strong class="example">Example 3:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2020/12/20/ex3.jpg" style="width: 622px; height: 182px;" />

```text

**Input:** p = [1,2,1], q = [1,1,2]
**Output:** false

```

 

**Constraints:**

	- The number of nodes in both trees is in the range `[0, 100]`.

	- `-10<sup>4</sup> <= Node.val <= 10<sup>4</sup>`

</details>

```java
boolean isSameTree(TreeNode p, TreeNode q) {
    if (p == null || q == null) return p == q; // If either is null, they must both be null to be the same
    // Check if values match and recurse on both left and right subtrees
    return p.val == q.val && isSameTree(p.left, q.left) && isSameTree(p.right, q.right);
}
```

### Count Good Nodes
**Category:** Tier 3 · Reference
**Pattern:** DFS carrying max-on-path  **Time:** O(n)  **Space:** O(h)
**Approach:** A node is "good" if no node on the root-to-it path has a greater value. Pass down the maximum seen so far; count the node when its value is at least that max, and update the running max for the recursive calls.

<!-- Problem Statement not automatically found -->

```java
int goodNodes(TreeNode root) {
    return dfs(root, Integer.MIN_VALUE); // Start DFS with the minimum possible value as maxSoFar
}
int dfs(TreeNode n, int maxSoFar) {
    if (n == null) return 0; // Base case: null nodes contribute 0
    int good = n.val >= maxSoFar ? 1 : 0; // It's a good node if its value is >= the max seen on its path
    int nextMax = Math.max(maxSoFar, n.val); // Update the maximum value for the child paths
    return good + dfs(n.left, nextMax) + dfs(n.right, nextMax); // Return current good node count + subtrees
}
```

---

## Tree Construction / Serialization

### Construct from Preorder & Inorder
**Category:** Tier 2 · Reinforce
**Pattern:** Recursive split + index map  **Time:** O(n)  **Space:** O(n)
**Approach:** Preorder's first element is always the root. Find it in inorder to split left/right subtrees; everything left of it in inorder is the left subtree. A hashmap of value→inorder-index gives O(1) lookups, and a moving preorder pointer feeds roots in order.

<!-- Problem Statement not automatically found -->

```java
int preIdx = 0; // Global index to track the current root in the preorder array
Map<Integer, Integer> inPos = new HashMap<>(); // Maps value to its index in inorder array for O(1) lookups
TreeNode buildTree(int[] preorder, int[] inorder) {
    for (int i = 0; i < inorder.length; i++) inPos.put(inorder[i], i); // Populate the map
    return build(preorder, 0, inorder.length - 1); // Start recursive build
}
TreeNode build(int[] preorder, int lo, int hi) {
    if (lo > hi) return null; // Base case: no elements to construct a tree
    int rootVal = preorder[preIdx++]; // Get the current root value and advance index
    TreeNode root = new TreeNode(rootVal); // Create the root node
    int mid = inPos.get(rootVal); // Find the root's position in the inorder array
    root.left = build(preorder, lo, mid - 1); // Build left subtree from elements left of mid
    root.right = build(preorder, mid + 1, hi); // Build right subtree from elements right of mid
    return root; // Return the constructed subtree
}
```

### Serialize and Deserialize Binary Tree
**Category:** ⭐ Tier 1 · Core
**Pattern:** Preorder with null markers  **Time:** O(n)  **Space:** O(n)
**Approach:** Serialize via preorder DFS, emitting a sentinel (e.g. `#`) for null children so structure is recoverable. Deserialize by consuming tokens in the same preorder: a `#` yields null, otherwise build a node and recurse for its two children.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Serialize and Deserialize Binary Tree](https://leetcode.com/problems/serialize-and-deserialize-binary-tree/)


Serialization is the process of converting a data structure or object into a sequence of bits so that it can be stored in a file or memory buffer, or transmitted across a network connection link to be reconstructed later in the same or another computer environment.

Design an algorithm to serialize and deserialize a binary tree. There is no restriction on how your serialization/deserialization algorithm should work. You just need to ensure that a binary tree can be serialized to a string and this string can be deserialized to the original tree structure.

**Clarification:** The input/output format is the same as <a href="https://support.leetcode.com/hc/en-us/articles/32442719377939-How-to-create-test-cases-on-LeetCode#h_01J5EGREAW3NAEJ14XC07GRW1A" target="_blank">how LeetCode serializes a binary tree</a>. You do not necessarily need to follow this format, so please be creative and come up with different approaches yourself.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2020/09/15/serdeser.jpg" style="width: 442px; height: 324px;" />

```text

**Input:** root = [1,2,3,null,null,4,5]
**Output:** [1,2,3,null,null,4,5]

```

<strong class="example">Example 2:</strong>

```text

**Input:** root = []
**Output:** []

```

 

**Constraints:**

	- The number of nodes in the tree is in the range `[0, 10<sup>4</sup>]`.

	- `-1000 <= Node.val <= 1000`

</details>

```java
String serialize(TreeNode root) {
    StringBuilder sb = new StringBuilder(); // Use StringBuilder for efficient string concatenation
    ser(root, sb); // Call the helper to serialize
    return sb.toString(); // Return the serialized string
}
void ser(TreeNode n, StringBuilder sb) {
    if (n == null) { sb.append("#,"); return; } // Append '#' for null nodes
    sb.append(n.val).append(','); // Append node value followed by a delimiter
    ser(n.left, sb); // Recursively serialize left subtree
    ser(n.right, sb); // Recursively serialize right subtree
}
TreeNode deserialize(String data) {
    Queue<String> q = new LinkedList<>(Arrays.asList(data.split(","))); // Split string by comma into a queue
    return de(q); // Call helper to construct the tree
}
TreeNode de(Queue<String> q) {
    String t = q.poll(); // Get the next token
    if (t.equals("#")) return null; // '#' means this was a null child
    TreeNode n = new TreeNode(Integer.parseInt(t)); // Parse value and create node
    n.left = de(q); // Recursively build left subtree
    n.right = de(q); // Recursively build right subtree
    return n; // Return the reconstructed node
}
```

### Flatten Binary Tree to Linked List
**Category:** Tier 3 · Reference
**Pattern:** Reverse-preorder / Morris-style  **Time:** O(n)  **Space:** O(1)
**Approach:** Flatten in place into a right-skewed preorder list. For each node with a left child, find the rightmost node of the left subtree, attach the current right subtree there, move the left subtree to the right, and null the left pointer. Advance to the next right node.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Flatten Binary Tree to Linked List](https://leetcode.com/problems/flatten-binary-tree-to-linked-list/)


Given the `root` of a binary tree, flatten the tree into a "linked list":

	- The "linked list" should use the same `TreeNode` class where the `right` child pointer points to the next node in the list and the `left` child pointer is always `null`.

	- The "linked list" should be in the same order as a <a href="https://en.wikipedia.org/wiki/Tree_traversal#Pre-order,_NLR" target="_blank">**pre-order**** traversal**</a> of the binary tree.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2021/01/14/flaten.jpg" style="width: 500px; height: 226px;" />

```text

**Input:** root = [1,2,5,3,4,null,6]
**Output:** [1,null,2,null,3,null,4,null,5,null,6]

```

<strong class="example">Example 2:</strong>

```text

**Input:** root = []
**Output:** []

```

<strong class="example">Example 3:</strong>

```text

**Input:** root = [0]
**Output:** [0]

```

 

**Constraints:**

	- The number of nodes in the tree is in the range `[0, 2000]`.

	- `-100 <= Node.val <= 100`

 
**Follow up:** Can you flatten the tree in-place (with `O(1)` extra space)?

</details>

```java
void flatten(TreeNode root) {
    TreeNode cur = root; // Start with the root
    while (cur != null) { // Process until all nodes are flattened
        if (cur.left != null) { // If there's a left subtree
            TreeNode pre = cur.left; // Find the rightmost node of the left subtree
            while (pre.right != null) pre = pre.right; // Keep going right
            pre.right = cur.right; // Attach the current node's right subtree to the predecessor's right
            cur.right = cur.left; // Move the entire left subtree to the right
            cur.left = null; // Clear the left child pointer
        }
        cur = cur.right; // Move to the next node in the flattened right spine
    }
}
```

---

## Binary Search Trees

### Validate BST
**Category:** ⭐ Tier 1 · Core
**Pattern:** DFS with (min, max) bounds  **Time:** O(n)  **Space:** O(h)
**Approach:** Each node must lie strictly within an open interval that tightens as you descend: going left lowers the upper bound to the node's value, going right raises the lower bound. Use `Long` bounds to avoid integer overflow at the extremes.

<!-- Problem Statement not automatically found -->

```java
boolean isValidBST(TreeNode root) {
    return valid(root, Long.MIN_VALUE, Long.MAX_VALUE); // Use Long to prevent overflow with Integer.MAX_VALUE/MIN_VALUE
}
boolean valid(TreeNode n, long min, long max) {
    if (n == null) return true; // Base case: null nodes are valid
    if (n.val <= min || n.val >= max) return false; // Must strictly be within the bounds (min, max)
    // Left child must be < n.val, right child must be > n.val
    return valid(n.left, min, n.val) && valid(n.right, n.val, max);
}
```

### Insert into BST
**Category:** Tier 3 · Reference
**Pattern:** BST descent  **Time:** O(h)  **Space:** O(h)
**Approach:** Walk down comparing the new value to the current node; recurse left or right. When you reach a null spot, that is where the new leaf belongs. Return the (possibly new) subtree root so parents reattach correctly.

<!-- Problem Statement not automatically found -->

```java
TreeNode insertIntoBST(TreeNode root, int val) {
    if (root == null) return new TreeNode(val); // Found the insertion point, create the new node
    if (val < root.val) root.left = insertIntoBST(root.left, val); // Recurse left if value is smaller
    else                root.right = insertIntoBST(root.right, val); // Recurse right if value is larger
    return root; // Return the unchanged root pointer
}
```

### Delete Node in BST
**Category:** Tier 3 · Reference
**Pattern:** BST descent + successor splice  **Time:** O(h)  **Space:** O(h)
**Approach:** Find the node by BST descent. If it has fewer than two children, replace it with its single child (or null). With two children, swap in its in-order successor (smallest in the right subtree), then delete that successor from the right subtree.

<!-- Problem Statement not automatically found -->

```java
TreeNode deleteNode(TreeNode root, int key) {
    if (root == null) return null; // Base case: key not found
    if (key < root.val)      root.left = deleteNode(root.left, key); // Key is smaller, search left
    else if (key > root.val) root.right = deleteNode(root.right, key); // Key is larger, search right
    else { // Node found
        if (root.left == null) return root.right; // Has only right child or no children
        if (root.right == null) return root.left; // Has only left child
        TreeNode succ = root.right; // Has two children: find the inorder successor
        while (succ.left != null) succ = succ.left; // Go as left as possible in right subtree
        root.val = succ.val; // Replace value with successor's value
        root.right = deleteNode(root.right, succ.val); // Delete the successor from the right subtree
    }
    return root; // Return the updated root
}
```

### Kth Smallest Element in BST
**Category:** ⭐ Tier 1 · Core
**Pattern:** Iterative inorder  **Time:** O(h + k)  **Space:** O(h)
**Approach:** An in-order traversal of a BST yields sorted values, so the kth popped node is the answer. Use an explicit stack and stop early once k nodes have been visited.

<!-- Problem Statement not automatically found -->

```java
int kthSmallest(TreeNode root, int k) {
    Deque<TreeNode> st = new ArrayDeque<>(); // Stack to track nodes for inorder traversal
    TreeNode cur = root; // Start from the root
    while (cur != null || !st.isEmpty()) { // Traverse while nodes remain
        while (cur != null) { st.push(cur); cur = cur.left; } // Go left as far as possible
        cur = st.pop(); // Process the smallest unvisited node
        if (--k == 0) return cur.val; // If it's the kth node, return its value
        cur = cur.right; // Move to the right subtree to continue inorder traversal
    }
    return -1;   // Return -1 if k is invalid or out of bounds
}
```

### Lowest Common Ancestor of BST
**Category:** Tier 3 · Reference
**Pattern:** BST descent  **Time:** O(h)  **Space:** O(1)
**Approach:** Exploit ordering: if both p and q are smaller than the current node, the LCA is in the left subtree; if both larger, go right. The first node where they split (or that equals one of them) is the LCA.

<!-- Problem Statement not automatically found -->

```java
TreeNode lcaBST(TreeNode root, TreeNode p, TreeNode q) {
    TreeNode cur = root; // Start searching from the root
    while (cur != null) { // Traverse the BST
        if (p.val < cur.val && q.val < cur.val)      cur = cur.left; // Both nodes are smaller, move left
        else if (p.val > cur.val && q.val > cur.val) cur = cur.right; // Both nodes are larger, move right
        else return cur; // Split point found or found one of the nodes, this is the LCA
    }
    return null; // Return null if the tree is empty or nodes not found
}
```

### Convert Sorted Array to BST
**Category:** Tier 3 · Reference
**Pattern:** Divide & conquer on midpoint  **Time:** O(n)  **Space:** O(log n)
**Approach:** Pick the middle element as the root to keep the tree height-balanced, then recursively build the left subtree from the left half and the right subtree from the right half.

<!-- Problem Statement not automatically found -->

```java
TreeNode sortedArrayToBST(int[] nums) {
    return build(nums, 0, nums.length - 1); // Helper handles the bounds
}
TreeNode build(int[] nums, int lo, int hi) {
    if (lo > hi) return null; // Base case: invalid range
    int mid = lo + (hi - lo) / 2; // Choose the middle element to ensure balance
    TreeNode root = new TreeNode(nums[mid]); // Create the root from the middle element
    root.left = build(nums, lo, mid - 1); // Recursively build left half
    root.right = build(nums, mid + 1, hi); // Recursively build right half
    return root; // Return the constructed balanced BST
}
```

### BST Iterator
**Category:** Tier 3 · Reference
**Pattern:** Controlled inorder via stack  **Time:** O(1) amortized next/hasNext  **Space:** O(h)
**Approach:** Lazily simulate in-order traversal. Push all left nodes from a starting point; `next()` pops a node, then pushes the left spine of its right child. Each node is pushed and popped exactly once, so amortized cost is O(1).

<!-- Problem Statement not automatically found -->

```java
class BSTIterator {
    private Deque<TreeNode> st = new ArrayDeque<>(); // Stack for partial inorder traversal
    public BSTIterator(TreeNode root) { pushLeft(root); } // Initialize by pushing the left spine
    private void pushLeft(TreeNode n) { // Helper to push all left children
        while (n != null) { st.push(n); n = n.left; } // Keep pushing and moving left
    }
    public int next() { // Get the next smallest element
        TreeNode n = st.pop(); // Pop the smallest remaining element
        pushLeft(n.right); // Before returning, push the left spine of its right child
        return n.val; // Return the value
    }
    public boolean hasNext() { return !st.isEmpty(); } // If stack is not empty, there are more elements
}
```

---

## Tries

### Implement Trie (Prefix Tree)
**Category:** ⭐ Tier 1 · Core
**Pattern:** Children-array trie  **Time:** O(L) per op  **Space:** O(total chars)
**Approach:** Each node holds 26 child links and an end-of-word flag. Insert walks/creates nodes per character; `search` requires the terminal flag set, while `startsWith` only needs the prefix path to exist.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Implement Trie (Prefix Tree)](https://leetcode.com/problems/implement-trie-prefix-tree/)


A <a href="https://en.wikipedia.org/wiki/Trie" target="_blank">**trie**</a> (pronounced as "try") or **prefix tree** is a tree data structure used to efficiently store and retrieve keys in a dataset of strings. There are various applications of this data structure, such as autocomplete and spellchecker.

Implement the Trie class:

	- `Trie()` Initializes the trie object.

	- `void insert(String word)` Inserts the string `word` into the trie.

	- `boolean search(String word)` Returns `true` if the string `word` is in the trie (i.e., was inserted before), and `false` otherwise.

	- `boolean startsWith(String prefix)` Returns `true` if there is a previously inserted string `word` that has the prefix `prefix`, and `false` otherwise.

 

<strong class="example">Example 1:</strong>

```text

**Input**
["Trie", "insert", "search", "search", "startsWith", "insert", "search"]
[[], ["apple"], ["apple"], ["app"], ["app"], ["app"], ["app"]]
**Output**
[null, null, true, false, true, null, true]

**Explanation**
Trie trie = new Trie();
trie.insert("apple");
trie.search("apple");   // return True
trie.search("app");     // return False
trie.startsWith("app"); // return True
trie.insert("app");
trie.search("app");     // return True

```

 

**Constraints:**

	- `1 <= word.length, prefix.length <= 2000`

	- `word` and `prefix` consist only of lowercase English letters.

	- At most `3 * 10<sup>4</sup>` calls **in total** will be made to `insert`, `search`, and `startsWith`.

</details>

```java
class Trie {
    private final Trie[] kids = new Trie[26]; // Array holding links to child nodes (a-z)
    private boolean end; // Flag to indicate if a word ends at this node
    public void insert(String word) {
        Trie n = this; // Start from the root of the Trie
        for (char c : word.toCharArray()) { // Iterate through each character of the word
            int i = c - 'a'; // Get the index (0-25) for the character
            if (n.kids[i] == null) n.kids[i] = new Trie(); // Create a new node if the path doesn't exist
            n = n.kids[i]; // Move to the child node
        }
        n.end = true; // Mark the end of the inserted word
    }
    public boolean search(String word) {
        Trie n = find(word); // Attempt to find the node where the word ends
        return n != null && n.end; // It's a word if the node exists and is marked as an end
    }
    public boolean startsWith(String prefix) {
        return find(prefix) != null; // It's a prefix if the path exists, regardless of the end flag
    }
    private Trie find(String s) { // Helper method to trace a string path
        Trie n = this; // Start from the root
        for (char c : s.toCharArray()) { // Traverse character by character
            n = n.kids[c - 'a']; // Move to the corresponding child
            if (n == null) return null; // Path breaks, prefix/word doesn't exist
        }
        return n; // Return the final node reached
    }
}
```

### Add and Search Word (with '.' wildcard)
**Category:** Tier 3 · Reference
**Pattern:** Trie + DFS for wildcard  **Time:** insert O(L), search O(26^dots · L)  **Space:** O(total chars)
**Approach:** Insert is a normal trie insert. Search recurses character by character; on a literal it follows the one matching edge, but on `.` it must try all 26 children. The dot branching is what makes search potentially exponential in the number of dots.

<!-- Problem Statement not automatically found -->

```java
class WordDictionary {
    private final WordDictionary[] kids = new WordDictionary[26]; // Links to child nodes for 'a'-'z'
    private boolean end; // Flag indicating if a valid word ends here
    public void addWord(String word) {
        WordDictionary n = this; // Start at the root
        for (char c : word.toCharArray()) { // Insert character by character
            int i = c - 'a'; // Convert character to an index 0-25
            if (n.kids[i] == null) n.kids[i] = new WordDictionary(); // Create child if missing
            n = n.kids[i]; // Move to the child node
        }
        n.end = true; // Mark the final node as a complete word
    }
    public boolean search(String word) { return dfs(word, 0, this); } // Initiate DFS to handle '.' wildcards
    private boolean dfs(String w, int i, WordDictionary n) {
        if (n == null) return false; // Reached a null node, path is invalid
        if (i == w.length()) return n.end; // Reached end of string, check if it's a valid word
        char c = w.charAt(i); // Get current character
        if (c == '.') { // Wildcard character: check all possible children
            for (WordDictionary k : n.kids) // Iterate over all 26 possible children
                if (dfs(w, i + 1, k)) return true; // If any path matches, return true
            return false; // No valid path found for the wildcard
        }
        return dfs(w, i + 1, n.kids[c - 'a']); // Normal character: follow the specific edge
    }
}
```

### Word Search II (Trie + DFS)
**Category:** Tier 2 · Reinforce
**Pattern:** Trie-pruned grid backtracking  **Time:** O(M·N·4·3^(L-1))  **Space:** O(total chars)
**Approach:** Build a trie of all words so a single board DFS can match many words at once and prune dead branches instantly. From every cell, walk the board following trie edges; when a node carries a word, record it (and null the word field to dedupe). Mark visited cells with a sentinel and restore on backtrack.

<!-- Problem Statement not automatically found -->

```java
class WordSearchII {
    static class Node { Node[] kids = new Node[26]; String word; } // Trie node holds an entire word at its end
    public List<String> findWords(char[][] board, String[] words) {
        Node root = new Node(); // Root of the Trie
        for (String w : words) { // Insert all search words into the Trie
            Node n = root; // Start at root for each word
            for (char c : w.toCharArray()) { // Traverse characters
                int i = c - 'a'; // Get index for character
                if (n.kids[i] == null) n.kids[i] = new Node(); // Create node if missing
                n = n.kids[i]; // Move to child
            }
            n.word = w; // Store the word at the final node for O(1) retrieval
        }
        List<String> out = new ArrayList<>(); // Result list
        for (int r = 0; r < board.length; r++) // Try starting a word from every cell
            for (int c = 0; c < board[0].length; c++)
                dfs(board, r, c, root, out); // Initiate DFS from this cell
        return out; // Return found words
    }
    private void dfs(char[][] b, int r, int c, Node n, List<String> out) {
        if (r < 0 || c < 0 || r >= b.length || c >= b[0].length) return; // Bounds check
        char ch = b[r][c]; // Get character at current cell
        if (ch == '#' || n.kids[ch - 'a'] == null) return; // Stop if visited ('#') or path not in Trie
        n = n.kids[ch - 'a']; // Advance the Trie node pointer
        if (n.word != null) { out.add(n.word); n.word = null; } // Word found! Add it and deduplicate by setting to null
        b[r][c] = '#'; // Mark the cell as visited to prevent self-intersection
        dfs(b, r + 1, c, n, out); // Explore Down
        dfs(b, r - 1, c, n, out); // Explore Up
        dfs(b, r, c + 1, n, out); // Explore Right
        dfs(b, r, c - 1, n, out); // Explore Left
        b[r][c] = ch; // Backtrack: restore the original character
    }
}
```

### Replace Words
**Category:** Tier 3 · Reference
**Pattern:** Trie shortest-root lookup  **Time:** O(total chars)  **Space:** O(total chars)
**Approach:** Insert all dictionary roots into a trie. For each word in the sentence, walk the trie character by character and stop at the first end-of-word node found — that is the shortest matching root. If no root matches, keep the original word.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Replace Words](https://leetcode.com/problems/replace-words/)


In English, we have a concept called **root**, which can be followed by some other word to form another longer word - let's call this word **derivative**. For example, when the **root** `"help"` is followed by the word `"ful"`, we can form a derivative `"helpful"`.

Given a `dictionary` consisting of many **roots** and a `sentence` consisting of words separated by spaces, replace all the derivatives in the sentence with the **root** forming it. If a derivative can be replaced by more than one **root**, replace it with the **root** that has **the shortest length**.

Return *the `sentence`* after the replacement.

 

<strong class="example">Example 1:</strong>

```text

**Input:** dictionary = ["cat","bat","rat"], sentence = "the cattle was rattled by the battery"
**Output:** "the cat was rat by the bat"

```

<strong class="example">Example 2:</strong>

```text

**Input:** dictionary = ["a","b","c"], sentence = "aadsfasf absbs bbab cadsfafs"
**Output:** "a a b c"

```

 

**Constraints:**

	- `1 <= dictionary.length <= 1000`

	- `1 <= dictionary[i].length <= 100`

	- `dictionary[i]` consists of only lower-case letters.

	- `1 <= sentence.length <= 10<sup>6</sup>`

	- `sentence` consists of only lower-case letters and spaces.

	- The number of words in `sentence` is in the range `[1, 1000]`

	- The length of each word in `sentence` is in the range `[1, 1000]`

	- Every two consecutive words in `sentence` will be separated by exactly one space.

	- `sentence` does not have leading or trailing spaces.

</details>

```java
class ReplaceWords {
    static class Node { Node[] kids = new Node[26]; boolean end; } // Trie node definition
    public String replaceWords(List<String> dict, String sentence) {
        Node root = new Node(); // Initialize the root of the Trie
        for (String w : dict) { // Insert all dictionary roots into the Trie
            Node n = root; // Start at root for each word
            for (char c : w.toCharArray()) { // Iterate characters
                int i = c - 'a'; // Calculate index
                if (n.kids[i] == null) n.kids[i] = new Node(); // Create node if missing
                n = n.kids[i]; // Traverse to child
            }
            n.end = true; // Mark the end of the root word
        }
        String[] words = sentence.split(" "); // Split the sentence into individual words
        StringBuilder sb = new StringBuilder(); // StringBuilder for the new sentence
        for (int j = 0; j < words.length; j++) { // Process each word
            if (j > 0) sb.append(' '); // Append a space between words
            sb.append(shortestRoot(root, words[j])); // Find and append the shortest root replacement
        }
        return sb.toString(); // Return the modified sentence
    }
    private String shortestRoot(Node root, String word) {
        Node n = root; // Start searching from Trie root
        StringBuilder pre = new StringBuilder(); // To build the matched prefix
        for (char c : word.toCharArray()) { // Iterate through the word's characters
            Node nxt = n.kids[c - 'a']; // Get the child node
            if (nxt == null) return word; // If path breaks, no root matches, return original word
            pre.append(c); // Append character to the prefix being built
            if (nxt.end) return pre.toString(); // If we hit an end marker, it's the shortest root, return it
            n = nxt; // Continue down the Trie
        }
        return word; // If we finish without hitting an end, return original word
    }
}
```

---

## Heaps / Priority Queue

### Kth Largest Element in an Array
**Category:** Tier 2 · Reinforce
**Pattern:** Min-heap of size k  **Time:** O(n log k)  **Space:** O(k)
**Approach:** Keep a min-heap of the k largest values seen. Push each number, and when the heap exceeds k, pop the smallest; the root is always the kth largest so far. The final root is the answer.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Kth Largest Element in an Array](https://leetcode.com/problems/kth-largest-element-in-an-array/)


Given an integer array `nums` and an integer `k`, return *the* `k<sup>th</sup>` *largest element in the array*.

Note that it is the `k<sup>th</sup>` largest element in the sorted order, not the `k<sup>th</sup>` distinct element.

Can you solve it without sorting?

 

<strong class="example">Example 1:</strong>

```text
**Input:** nums = [3,2,1,5,6,4], k = 2
**Output:** 5

```

<strong class="example">Example 2:</strong>

```text
**Input:** nums = [3,2,3,1,2,4,5,5,6], k = 4
**Output:** 4

```

 

**Constraints:**

	- `1 <= k <= nums.length <= 10<sup>5</sup>`

	- `-10<sup>4</sup> <= nums[i] <= 10<sup>4</sup>`

</details>

```java
int findKthLargest(int[] nums, int k) {
    PriorityQueue<Integer> heap = new PriorityQueue<>(); // min-heap to store the k largest elements
    for (int x : nums) { // Iterate through the array
        heap.offer(x); // Add element to the heap
        if (heap.size() > k) heap.poll(); // If heap exceeds size k, remove the smallest element
    }
    return heap.peek(); // The root of the min-heap is the kth largest element
}
```
**Alternative:** Quickselect — partition around a pivot targeting index `n-k`; average O(n), worst O(n^2). Recurse only into the side containing the target index instead of fully sorting.
```java
int quickselect(int[] nums, int k) {
    int target = nums.length - k, lo = 0, hi = nums.length - 1; // target index for kth largest in a sorted array
    Random rnd = new Random(); // Random number generator for pivot selection
    while (lo < hi) { // Loop until the search space is narrowed to 1 element
        int p = partition(nums, lo, hi, lo + rnd.nextInt(hi - lo + 1)); // Partition around a random pivot
        if (p == target) break; // Found the target index
        else if (p < target) lo = p + 1; // Target is in the right half
        else hi = p - 1; // Target is in the left half
    }
    return nums[target]; // Return the element at the target index
}
int partition(int[] a, int lo, int hi, int pivot) {
    int pv = a[pivot]; // Store the pivot value
    swap(a, pivot, hi); // Move pivot to the end
    int store = lo; // Pointer for the smaller elements
    for (int i = lo; i < hi; i++) // Iterate through the range
        if (a[i] < pv) swap(a, i, store++); // Swap elements smaller than pivot to the left
    swap(a, store, hi); // Restore pivot to its correct sorted position
    return store; // Return the final index of the pivot
}
void swap(int[] a, int i, int j) { int t = a[i]; a[i] = a[j]; a[j] = t; } // Utility to swap array elements
```

### Top K Frequent Elements
**Category:** ⭐ Tier 1 · Core
**Pattern:** Count + min-heap (or bucket sort)  **Time:** O(n log k)  **Space:** O(n)
**Approach:** Count frequencies in a hashmap, then keep a min-heap of size k ordered by frequency, evicting the least frequent when it overflows. Drain the heap for the answer. Bucket sort by frequency gives an O(n) alternative.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Top K Frequent Elements](https://leetcode.com/problems/top-k-frequent-elements/)


Given an integer array `nums` and an integer `k`, return *the* `k` *most frequent elements*. You may return the answer in **any order**.

 

<strong class="example">Example 1:</strong>

<div class="example-block">

**Input:** <span class="example-io">nums = [1,1,1,2,2,3], k = 2</span>

**Output:** <span class="example-io">[1,2]</span>
</div>

<strong class="example">Example 2:</strong>

<div class="example-block">

**Input:** <span class="example-io">nums = [1], k = 1</span>

**Output:** <span class="example-io">[1]</span>
</div>

<strong class="example">Example 3:</strong>

<div class="example-block">

**Input:** <span class="example-io">nums = [1,2,1,2,1,2,3,1,3,2], k = 2</span>

**Output:** <span class="example-io">[1,2]</span>
</div>

 

**Constraints:**

	- `1 <= nums.length <= 10<sup>5</sup>`

	- `-10<sup>4</sup> <= nums[i] <= 10<sup>4</sup>`

	- `k` is in the range `[1, the number of unique elements in the array]`.

	- It is **guaranteed** that the answer is **unique**.

 

**Follow up:** Your algorithm's time complexity must be better than `O(n log n)`, where n is the array's size.

</details>

```java
int[] topKFrequent(int[] nums, int k) {
    Map<Integer, Integer> freq = new HashMap<>(); // Map to store frequencies of each number
    for (int x : nums) freq.merge(x, 1, Integer::sum); // Count frequencies
    PriorityQueue<Integer> heap = // Min-heap based on frequency
        new PriorityQueue<>((a, b) -> freq.get(a) - freq.get(b));
    for (int key : freq.keySet()) { // Process each unique number
        heap.offer(key); // Add to heap
        if (heap.size() > k) heap.poll(); // Keep only the top k frequent elements
    }
    int[] out = new int[k]; // Result array
    for (int i = k - 1; i >= 0; i--) out[i] = heap.poll(); // Populate array (optional reverse for order)
    return out; // Return the top k elements
}
```
**Alternative:** Bucket sort — index buckets by frequency (1..n) and collect from the high end for O(n).

### K Closest Points to Origin
**Category:** Tier 2 · Reinforce
**Pattern:** Max-heap of size k  **Time:** O(n log k)  **Space:** O(k)
**Approach:** Use squared distance (avoid sqrt). Keep a max-heap of size k so the farthest of the current k is at the top; whenever the heap overflows, evict that farthest point. What remains are the k closest.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [K Closest Points to Origin](https://leetcode.com/problems/k-closest-points-to-origin/)


Given an array of `points` where `points[i] = [x<sub>i</sub>, y<sub>i</sub>]` represents a point on the **X-Y** plane and an integer `k`, return the `k` closest points to the origin `(0, 0)`.

The distance between two points on the **X-Y** plane is the Euclidean distance (i.e., `&radic;(x<sub>1</sub> - x<sub>2</sub>)<sup>2</sup> + (y<sub>1</sub> - y<sub>2</sub>)<sup>2</sup>`).

You may return the answer in **any order**. The answer is **guaranteed** to be **unique** (except for the order that it is in).

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2021/03/03/closestplane1.jpg" style="width: 400px; height: 400px;" />

```text

**Input:** points = [[1,3],[-2,2]], k = 1
**Output:** [[-2,2]]
**Explanation:**
The distance between (1, 3) and the origin is sqrt(10).
The distance between (-2, 2) and the origin is sqrt(8).
Since sqrt(8) < sqrt(10), (-2, 2) is closer to the origin.
We only want the closest k = 1 points from the origin, so the answer is just [[-2,2]].

```

<strong class="example">Example 2:</strong>

```text

**Input:** points = [[3,3],[5,-1],[-2,4]], k = 2
**Output:** [[3,3],[-2,4]]
**Explanation:** The answer [[-2,4],[3,3]] would also be accepted.

```

 

**Constraints:**

	- `1 <= k <= points.length <= 10<sup>4</sup>`

	- `-10<sup>4</sup> <= x<sub>i</sub>, y<sub>i</sub> <= 10<sup>4</sup>`

</details>

```java
int[][] kClosest(int[][] points, int k) {
    PriorityQueue<int[]> heap = new PriorityQueue<>( // Max-heap based on squared distance from origin
        (a, b) -> (b[0]*b[0] + b[1]*b[1]) - (a[0]*a[0] + a[1]*a[1]));
    for (int[] p : points) { // Process each point
        heap.offer(p); // Add point to the max-heap
        if (heap.size() > k) heap.poll(); // Remove the farthest point if we exceed size k
    }
    int[][] out = new int[k][2]; // Array to hold the k closest points
    for (int i = 0; i < k; i++) out[i] = heap.poll(); // Extract the remaining points from the heap
    return out; // Return the answer
}
```

### Find Median from Data Stream
**Category:** ⭐ Tier 1 · Core
**Pattern:** Two balanced heaps  **Time:** O(log n) add, O(1) median  **Space:** O(n)
**Approach:** Keep a max-heap (`lo`) for the smaller half and a min-heap (`hi`) for the larger half. Push to `lo`, shift its top into `hi`, then rebalance so `lo` is never smaller than `hi`. The median is `lo`'s top (odd total) or the average of both tops (even).

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Find Median from Data Stream](https://leetcode.com/problems/find-median-from-data-stream/)


The **median** is the middle value in an ordered integer list. If the size of the list is even, there is no middle value, and the median is the mean of the two middle values.

	- For example, for `arr = [2,3,4]`, the median is `3`.

	- For example, for `arr = [2,3]`, the median is `(2 + 3) / 2 = 2.5`.

Implement the MedianFinder class:

	- `MedianFinder()` initializes the `MedianFinder` object.

	- `void addNum(int num)` adds the integer `num` from the data stream to the data structure.

	- `double findMedian()` returns the median of all elements so far. Answers within `10<sup>-5</sup>` of the actual answer will be accepted.

 

<strong class="example">Example 1:</strong>

```text

**Input**
["MedianFinder", "addNum", "addNum", "findMedian", "addNum", "findMedian"]
[[], [1], [2], [], [3], []]
**Output**
[null, null, null, 1.5, null, 2.0]

**Explanation**
MedianFinder medianFinder = new MedianFinder();
medianFinder.addNum(1);    // arr = [1]
medianFinder.addNum(2);    // arr = [1, 2]
medianFinder.findMedian(); // return 1.5 (i.e., (1 + 2) / 2)
medianFinder.addNum(3);    // arr[1, 2, 3]
medianFinder.findMedian(); // return 2.0

```

 

**Constraints:**

	- `-10<sup>5</sup> <= num <= 10<sup>5</sup>`

	- There will be at least one element in the data structure before calling `findMedian`.

	- At most `5 * 10<sup>4</sup>` calls will be made to `addNum` and `findMedian`.

 

**Follow up:**

	- If all integer numbers from the stream are in the range `[0, 100]`, how would you optimize your solution?

	- If `99%` of all integer numbers from the stream are in the range `[0, 100]`, how would you optimize your solution?

</details>

```java
class MedianFinder {
    private PriorityQueue<Integer> lo = new PriorityQueue<>(Collections.reverseOrder()); // Max-heap for the smaller half
    private PriorityQueue<Integer> hi = new PriorityQueue<>(); // Min-heap for the larger half
    public void addNum(int num) {
        lo.offer(num); // Always add to max-heap first
        hi.offer(lo.poll()); // Move the largest of the smaller half to the min-heap to balance values
        if (hi.size() > lo.size()) lo.offer(hi.poll()); // Keep max-heap size >= min-heap size
    }
    public double findMedian() {
        if (lo.size() > hi.size()) return lo.peek(); // Odd number of elements: median is top of max-heap
        return (lo.peek() + hi.peek()) / 2.0; // Even number of elements: average of both tops
    }
}
```

### Merge K Sorted Lists
**Category:** ⭐ Tier 1 · Core
**Pattern:** Min-heap of list heads  **Time:** O(n log k)  **Space:** O(k)
**Approach:** Seed a min-heap with the head of every list. Repeatedly pop the smallest node, append it to the result, and push its successor. The heap always holds at most k candidates, one per list. (Uses the standard `ListNode`.)

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Merge K Sorted Lists](https://leetcode.com/problems/merge-k-sorted-lists/)


You are given an array of `k` linked-lists `lists`, each linked-list is sorted in ascending order.

*Merge all the linked-lists into one sorted linked-list and return it.*

 

<strong class="example">Example 1:</strong>

```text

**Input:** lists = [[1,4,5],[1,3,4],[2,6]]
**Output:** [1,1,2,3,4,4,5,6]
**Explanation:** The linked-lists are:
[
  1->4->5,
  1->3->4,
  2->6
]
merging them into one sorted linked list:
1->1->2->3->4->4->5->6

```

<strong class="example">Example 2:</strong>

```text

**Input:** lists = []
**Output:** []

```

<strong class="example">Example 3:</strong>

```text

**Input:** lists = [[]]
**Output:** []

```

 

**Constraints:**

	- `k == lists.length`

	- `0 <= k <= 10<sup>4</sup>`

	- `0 <= lists[i].length <= 500`

	- `-10<sup>4</sup> <= lists[i][j] <= 10<sup>4</sup>`

	- `lists[i]` is sorted in **ascending order**.

	- The sum of `lists[i].length` will not exceed `10<sup>4</sup>`.

</details>

```java
// class ListNode { int val; ListNode next; ListNode(int v){val=v;} }
ListNode mergeKLists(ListNode[] lists) {
    PriorityQueue<ListNode> heap = new PriorityQueue<>((a, b) -> a.val - b.val); // Min-heap to find smallest node
    for (ListNode l : lists) if (l != null) heap.offer(l); // Insert the head of each list into the heap
    ListNode dummy = new ListNode(0), tail = dummy; // Dummy node to simplify appending
    while (!heap.isEmpty()) { // Process until all nodes are merged
        ListNode n = heap.poll(); // Extract the smallest node
        tail.next = n; // Append it to the merged list
        tail = n; // Move the tail pointer
        if (n.next != null) heap.offer(n.next); // Push the next node from the extracted node's list
    }
    return dummy.next; // Return the merged head
}
```

### Kth Smallest in a Sorted Matrix
**Category:** Tier 3 · Reference
**Pattern:** Binary search on value  **Time:** O(n log(max-min))  **Space:** O(1)
**Approach:** Each row and column is sorted, so binary search the value range. For a candidate value, count entries ≤ it by walking from the bottom-left corner in O(n). Narrow the range until lo == hi, which lands on a matrix value.

<!-- Problem Statement not automatically found -->

```java
int kthSmallest(int[][] matrix, int k) {
    int n = matrix.length; // Matrix dimensions
    int lo = matrix[0][0], hi = matrix[n-1][n-1]; // Binary search bounds based on values
    while (lo < hi) { // Binary search on the value range
        int mid = lo + (hi - lo) / 2; // Midpoint value
        if (countLE(matrix, mid) < k) lo = mid + 1; // If fewer than k elements are <= mid, target is larger
        else hi = mid; // Otherwise, target is <= mid
    }
    return lo; // lo converges to the exact kth smallest value
}
int countLE(int[][] m, int val) { // Helper to count elements <= val
    int n = m.length, r = n - 1, c = 0, count = 0; // Start at bottom-left corner
    while (r >= 0 && c < n) { // Traverse within bounds
        if (m[r][c] <= val) { count += r + 1; c++; } // If current is <= val, all above in column are too; move right
        else r--; // Otherwise, current is > val; move up
    }
    return count; // Total count of elements <= val
}
```
**Alternative:** Min-heap of size k seeded with the first row, expanding right/down — O(k log n).

### Task Scheduler
**Category:** Tier 2 · Reinforce
**Pattern:** Greedy with frequency math  **Time:** O(n)  **Space:** O(1)
**Approach:** The busiest task dictates the schedule's skeleton: `(maxFreq - 1)` full cooling frames of length `(n + 1)`, plus a final slot for every task tied at the max frequency. The answer is the max of that formula and the total task count (when there are enough distinct tasks to fill idle gaps).

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Task Scheduler](https://leetcode.com/problems/task-scheduler/)


You are given an array of CPU `tasks`, each labeled with a letter from A to Z, and a number `n`. Each CPU interval can be idle or allow the completion of one task. Tasks can be completed in any order, but there's a constraint: there has to be a gap of **at least** `n` intervals between two tasks with the same label.

Return the **minimum** number of CPU intervals required to complete all tasks.

 

<strong class="example">Example 1:</strong>

<div class="example-block" style="
    border-color: var(--border-tertiary);
    border-left-width: 2px;
    color: var(--text-secondary);
    font-size: .875rem;
    margin-bottom: 1rem;
    margin-top: 1rem;
    overflow: visible;
    padding-left: 1rem;
">

**Input:** <span class="example-io" style="
    font-family: Menlo,sans-serif;
    font-size: 0.85rem;
">tasks = ["A","A","A","B","B","B"], n = 2</span>

**Output:** <span class="example-io" style="
font-family: Menlo,sans-serif;
font-size: 0.85rem;
">8</span>

**Explanation:** A possible sequence is: A -> B -> idle -> A -> B -> idle -> A -> B.

After completing task A, you must wait two intervals before doing A again. The same applies to task B. In the 3<sup>rd</sup> interval, neither A nor B can be done, so you idle. By the 4<sup>th</sup> interval, you can do A again as 2 intervals have passed.
</div>

<strong class="example">Example 2:</strong>

<div class="example-block" style="
    border-color: var(--border-tertiary);
    border-left-width: 2px;
    color: var(--text-secondary);
    font-size: .875rem;
    margin-bottom: 1rem;
    margin-top: 1rem;
    overflow: visible;
    padding-left: 1rem;
">

**Input:** <span class="example-io" style="
    font-family: Menlo,sans-serif;
    font-size: 0.85rem;
">tasks = ["A","C","A","B","D","B"], n = 1</span>

**Output:** <span class="example-io" style="
    font-family: Menlo,sans-serif;
    font-size: 0.85rem;
">6</span>

**Explanation:** A possible sequence is: A -> B -> C -> D -> A -> B.

With a cooling interval of 1, you can repeat a task after just one other task.
</div>

<strong class="example">Example 3:</strong>

<div class="example-block" style="
    border-color: var(--border-tertiary);
    border-left-width: 2px;
    color: var(--text-secondary);
    font-size: .875rem;
    margin-bottom: 1rem;
    margin-top: 1rem;
    overflow: visible;
    padding-left: 1rem;
">

**Input:** <span class="example-io" style="
    font-family: Menlo,sans-serif;
    font-size: 0.85rem;
">tasks = ["A","A","A", "B","B","B"], n = 3</span>

**Output:** <span class="example-io" style="
    font-family: Menlo,sans-serif;
    font-size: 0.85rem;
">10</span>

**Explanation:** A possible sequence is: A -> B -> idle -> idle -> A -> B -> idle -> idle -> A -> B.

There are only two types of tasks, A and B, which need to be separated by 3 intervals. This leads to idling twice between repetitions of these tasks.
</div>

 

**Constraints:**

	- `1 <= tasks.length <= 10<sup>4</sup>`

	- `tasks[i]` is an uppercase English letter.

	- `0 <= n <= 100`

</details>

```java
int leastInterval(char[] tasks, int n) {
    int[] freq = new int[26]; // Array to count frequencies of tasks A-Z
    int max = 0, maxCount = 0; // max frequency, and how many tasks share that max frequency
    for (char t : tasks) { // Iterate and count
        freq[t - 'A']++;
        if (freq[t - 'A'] > max) { max = freq[t - 'A']; maxCount = 1; } // New max found
        else if (freq[t - 'A'] == max) maxCount++; // Tie for the max frequency
    }
    int slots = (max - 1) * (n + 1) + maxCount; // Calculate minimum slots based on idle time formula
    return Math.max(slots, tasks.length); // Return the max of formula result and total tasks
}
```

### Reorganize String
**Category:** Tier 3 · Reference
**Pattern:** Max-heap greedy  **Time:** O(n log 26)  **Space:** O(1)
**Approach:** Always place the most frequent remaining character that differs from the last placed one. Use a max-heap by count; hold the just-used character aside (decrementing its count) and push it back on the next iteration so it can't repeat adjacently. If no valid character is available mid-build, no arrangement exists.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Reorganize String](https://leetcode.com/problems/reorganize-string/)


Given a string `s`, rearrange the characters of `s` so that any two adjacent characters are not the same.

Return *any possible rearrangement of* `s` *or return* `""` *if not possible*.

 

<strong class="example">Example 1:</strong>

```text
**Input:** s = "aab"
**Output:** "aba"

```

<strong class="example">Example 2:</strong>

```text
**Input:** s = "aaab"
**Output:** ""

```

 

**Constraints:**

	- `1 <= s.length <= 500`

	- `s` consists of lowercase English letters.

</details>

```java
String reorganizeString(String s) {
    int[] freq = new int[26]; // Array to count character frequencies
    for (char c : s.toCharArray()) freq[c - 'a']++; // Populate frequencies
    PriorityQueue<int[]> heap = new PriorityQueue<>((a, b) -> b[1] - a[1]); // Max-heap storing {charIndex, count}
    for (int i = 0; i < 26; i++) // Add non-zero frequencies to the heap
        if (freq[i] > 0) heap.offer(new int[]{i, freq[i]});
    StringBuilder sb = new StringBuilder(); // Construct the result string
    int[] prev = null; // Store the previously placed character to avoid adjacent duplicates
    while (!heap.isEmpty()) { // Process characters
        int[] cur = heap.poll(); // Get the most frequent available character
        sb.append((char) ('a' + cur[0])); // Append it
        cur[1]--; // Decrement its remaining count
        if (prev != null && prev[1] > 0) heap.offer(prev); // Re-add the previous character if it still has remaining instances
        prev = cur; // Set current character as previous for the next iteration
    }
    return sb.length() == s.length() ? sb.toString() : ""; // Return the result or "" if it's impossible
}
```
