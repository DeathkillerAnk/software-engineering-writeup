# 05 · Trees, Tries & Heaps

Patterns and idiomatic Java for binary trees, BSTs, tries, and heap / priority-queue problems.

```java
// Shared node definition used throughout this sheet.
public class TreeNode {
    int val;
    TreeNode left, right;
    TreeNode() {}
    TreeNode(int val) { this.val = val; }
    TreeNode(int val, TreeNode left, TreeNode right) {
        this.val = val;
        this.left = left;
        this.right = right;
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
    List<Integer> out = new ArrayList<>();
    pre(root, out);
    return out;
}
void pre(TreeNode n, List<Integer> out) {
    if (n == null) return;
    out.add(n.val);
    pre(n.left, out);
    pre(n.right, out);
}
void in(TreeNode n, List<Integer> out) {
    if (n == null) return;
    in(n.left, out);
    out.add(n.val);
    in(n.right, out);
}
void post(TreeNode n, List<Integer> out) {
    if (n == null) return;
    post(n.left, out);
    post(n.right, out);
    out.add(n.val);
}
```

### Preorder / Inorder / Postorder (Iterative)
**Category:** ⭐ Tier 1 · Core
**Pattern:** Explicit stack  **Time:** O(n)  **Space:** O(h)
**Approach:** Simulate the call stack manually. Preorder pushes right then left so left pops first. Inorder walks left pushing nodes, then pops and goes right. Postorder is most cleanly done as a reversed "root-right-left" preorder.

<!-- Problem Statement not automatically found -->

```java
List<Integer> preIter(TreeNode root) {
    List<Integer> out = new ArrayList<>();
    if (root == null) return out;
    Deque<TreeNode> st = new ArrayDeque<>();
    st.push(root);
    while (!st.isEmpty()) {
        TreeNode n = st.pop();
        out.add(n.val);
        if (n.right != null) st.push(n.right);
        if (n.left != null) st.push(n.left);
    }
    return out;
}
List<Integer> inIter(TreeNode root) {
    List<Integer> out = new ArrayList<>();
    Deque<TreeNode> st = new ArrayDeque<>();
    TreeNode cur = root;
    while (cur != null || !st.isEmpty()) {
        while (cur != null) { st.push(cur); cur = cur.left; }
        cur = st.pop();
        out.add(cur.val);
        cur = cur.right;
    }
    return out;
}
List<Integer> postIter(TreeNode root) {
    LinkedList<Integer> out = new LinkedList<>();
    if (root == null) return out;
    Deque<TreeNode> st = new ArrayDeque<>();
    st.push(root);
    while (!st.isEmpty()) {
        TreeNode n = st.pop();
        out.addFirst(n.val);            // reverse of root-right-left
        if (n.left != null) st.push(n.left);
        if (n.right != null) st.push(n.right);
    }
    return out;
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
    List<List<Integer>> out = new ArrayList<>();
    if (root == null) return out;
    Queue<TreeNode> q = new LinkedList<>();
    q.offer(root);
    while (!q.isEmpty()) {
        int sz = q.size();
        List<Integer> level = new ArrayList<>();
        for (int i = 0; i < sz; i++) {
            TreeNode n = q.poll();
            level.add(n.val);
            if (n.left != null) q.offer(n.left);
            if (n.right != null) q.offer(n.right);
        }
        out.add(level);
    }
    return out;
}
```

### Zigzag Level Order
**Category:** Tier 3 · Reference
**Pattern:** BFS + direction flag  **Time:** O(n)  **Space:** O(n)
**Approach:** Standard level-order BFS, but alternate the insertion order per level. Use a `LinkedList` and `addFirst` on right-to-left levels (or reverse the list) so even levels go left-to-right and odd levels go right-to-left.

<!-- Problem Statement not automatically found -->

```java
List<List<Integer>> zigzag(TreeNode root) {
    List<List<Integer>> out = new ArrayList<>();
    if (root == null) return out;
    Queue<TreeNode> q = new LinkedList<>();
    q.offer(root);
    boolean ltr = true;
    while (!q.isEmpty()) {
        int sz = q.size();
        LinkedList<Integer> level = new LinkedList<>();
        for (int i = 0; i < sz; i++) {
            TreeNode n = q.poll();
            if (ltr) level.addLast(n.val);
            else     level.addFirst(n.val);
            if (n.left != null) q.offer(n.left);
            if (n.right != null) q.offer(n.right);
        }
        out.add(level);
        ltr = !ltr;
    }
    return out;
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
    List<Integer> out = new ArrayList<>();
    if (root == null) return out;
    Queue<TreeNode> q = new LinkedList<>();
    q.offer(root);
    while (!q.isEmpty()) {
        int sz = q.size();
        for (int i = 0; i < sz; i++) {
            TreeNode n = q.poll();
            if (i == sz - 1) out.add(n.val);   // last in level
            if (n.left != null) q.offer(n.left);
            if (n.right != null) q.offer(n.right);
        }
    }
    return out;
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
    if (root == null) return 0;
    return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
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
int best = 0;
int diameterOfBinaryTree(TreeNode root) {
    height(root);
    return best;
}
int height(TreeNode n) {
    if (n == null) return 0;
    int l = height(n.left), r = height(n.right);
    best = Math.max(best, l + r);
    return 1 + Math.max(l, r);
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
    return check(root) != -1;
}
int check(TreeNode n) {
    if (n == null) return 0;
    int l = check(n.left);
    if (l == -1) return -1;
    int r = check(n.right);
    if (r == -1) return -1;
    if (Math.abs(l - r) > 1) return -1;
    return 1 + Math.max(l, r);
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
    if (root == null) return false;
    if (root.left == null && root.right == null) return target == root.val;
    int rem = target - root.val;
    return hasPathSum(root.left, rem) || hasPathSum(root.right, rem);
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
    List<List<Integer>> out = new ArrayList<>();
    dfs(root, target, new ArrayList<>(), out);
    return out;
}
void dfs(TreeNode n, int rem, List<Integer> path, List<List<Integer>> out) {
    if (n == null) return;
    path.add(n.val);
    if (n.left == null && n.right == null && rem == n.val) {
        out.add(new ArrayList<>(path));
    } else {
        dfs(n.left,  rem - n.val, path, out);
        dfs(n.right, rem - n.val, path, out);
    }
    path.remove(path.size() - 1);   // backtrack
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
    Map<Long, Integer> seen = new HashMap<>();
    seen.put(0L, 1);
    return dfs(root, 0L, target, seen);
}
int dfs(TreeNode n, long curr, int target, Map<Long, Integer> seen) {
    if (n == null) return 0;
    curr += n.val;
    int res = seen.getOrDefault(curr - target, 0);
    seen.merge(curr, 1, Integer::sum);
    res += dfs(n.left, curr, target, seen) + dfs(n.right, curr, target, seen);
    seen.merge(curr, -1, Integer::sum);   // backtrack
    return res;
}
```

### Lowest Common Ancestor (Binary Tree)
**Category:** ⭐ Tier 1 · Core
**Pattern:** DFS post-order  **Time:** O(n)  **Space:** O(h)
**Approach:** If the current node is null or equals p or q, return it. Recurse on both sides; if both return non-null, the current node is the split point and thus the LCA. Otherwise propagate whichever side found something.

<!-- Problem Statement not automatically found -->

```java
TreeNode lca(TreeNode root, TreeNode p, TreeNode q) {
    if (root == null || root == p || root == q) return root;
    TreeNode l = lca(root.left, p, q);
    TreeNode r = lca(root.right, p, q);
    if (l != null && r != null) return root;
    return l != null ? l : r;
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
int maxSum = Integer.MIN_VALUE;
int maxPathSum(TreeNode root) {
    gain(root);
    return maxSum;
}
int gain(TreeNode n) {
    if (n == null) return 0;
    int l = Math.max(gain(n.left), 0);
    int r = Math.max(gain(n.right), 0);
    maxSum = Math.max(maxSum, n.val + l + r);
    return n.val + Math.max(l, r);
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
    if (root == null) return null;
    TreeNode tmp = root.left;
    root.left = invertTree(root.right);
    root.right = invertTree(tmp);
    return root;
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
    return root == null || mirror(root.left, root.right);
}
boolean mirror(TreeNode a, TreeNode b) {
    if (a == null || b == null) return a == b;
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
    if (p == null || q == null) return p == q;
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
    return dfs(root, Integer.MIN_VALUE);
}
int dfs(TreeNode n, int maxSoFar) {
    if (n == null) return 0;
    int good = n.val >= maxSoFar ? 1 : 0;
    int nextMax = Math.max(maxSoFar, n.val);
    return good + dfs(n.left, nextMax) + dfs(n.right, nextMax);
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
int preIdx = 0;
Map<Integer, Integer> inPos = new HashMap<>();
TreeNode buildTree(int[] preorder, int[] inorder) {
    for (int i = 0; i < inorder.length; i++) inPos.put(inorder[i], i);
    return build(preorder, 0, inorder.length - 1);
}
TreeNode build(int[] preorder, int lo, int hi) {
    if (lo > hi) return null;
    int rootVal = preorder[preIdx++];
    TreeNode root = new TreeNode(rootVal);
    int mid = inPos.get(rootVal);
    root.left = build(preorder, lo, mid - 1);
    root.right = build(preorder, mid + 1, hi);
    return root;
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
    StringBuilder sb = new StringBuilder();
    ser(root, sb);
    return sb.toString();
}
void ser(TreeNode n, StringBuilder sb) {
    if (n == null) { sb.append("#,"); return; }
    sb.append(n.val).append(',');
    ser(n.left, sb);
    ser(n.right, sb);
}
TreeNode deserialize(String data) {
    Queue<String> q = new LinkedList<>(Arrays.asList(data.split(",")));
    return de(q);
}
TreeNode de(Queue<String> q) {
    String t = q.poll();
    if (t.equals("#")) return null;
    TreeNode n = new TreeNode(Integer.parseInt(t));
    n.left = de(q);
    n.right = de(q);
    return n;
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
    TreeNode cur = root;
    while (cur != null) {
        if (cur.left != null) {
            TreeNode pre = cur.left;
            while (pre.right != null) pre = pre.right;
            pre.right = cur.right;
            cur.right = cur.left;
            cur.left = null;
        }
        cur = cur.right;
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
    return valid(root, Long.MIN_VALUE, Long.MAX_VALUE);
}
boolean valid(TreeNode n, long min, long max) {
    if (n == null) return true;
    if (n.val <= min || n.val >= max) return false;
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
    if (root == null) return new TreeNode(val);
    if (val < root.val) root.left = insertIntoBST(root.left, val);
    else                root.right = insertIntoBST(root.right, val);
    return root;
}
```

### Delete Node in BST
**Category:** Tier 3 · Reference
**Pattern:** BST descent + successor splice  **Time:** O(h)  **Space:** O(h)
**Approach:** Find the node by BST descent. If it has fewer than two children, replace it with its single child (or null). With two children, swap in its in-order successor (smallest in the right subtree), then delete that successor from the right subtree.

<!-- Problem Statement not automatically found -->

```java
TreeNode deleteNode(TreeNode root, int key) {
    if (root == null) return null;
    if (key < root.val)      root.left = deleteNode(root.left, key);
    else if (key > root.val) root.right = deleteNode(root.right, key);
    else {
        if (root.left == null) return root.right;
        if (root.right == null) return root.left;
        TreeNode succ = root.right;
        while (succ.left != null) succ = succ.left;
        root.val = succ.val;
        root.right = deleteNode(root.right, succ.val);
    }
    return root;
}
```

### Kth Smallest Element in BST
**Category:** ⭐ Tier 1 · Core
**Pattern:** Iterative inorder  **Time:** O(h + k)  **Space:** O(h)
**Approach:** An in-order traversal of a BST yields sorted values, so the kth popped node is the answer. Use an explicit stack and stop early once k nodes have been visited.

<!-- Problem Statement not automatically found -->

```java
int kthSmallest(TreeNode root, int k) {
    Deque<TreeNode> st = new ArrayDeque<>();
    TreeNode cur = root;
    while (cur != null || !st.isEmpty()) {
        while (cur != null) { st.push(cur); cur = cur.left; }
        cur = st.pop();
        if (--k == 0) return cur.val;
        cur = cur.right;
    }
    return -1;   // k invalid
}
```

### Lowest Common Ancestor of BST
**Category:** Tier 3 · Reference
**Pattern:** BST descent  **Time:** O(h)  **Space:** O(1)
**Approach:** Exploit ordering: if both p and q are smaller than the current node, the LCA is in the left subtree; if both larger, go right. The first node where they split (or that equals one of them) is the LCA.

<!-- Problem Statement not automatically found -->

```java
TreeNode lcaBST(TreeNode root, TreeNode p, TreeNode q) {
    TreeNode cur = root;
    while (cur != null) {
        if (p.val < cur.val && q.val < cur.val)      cur = cur.left;
        else if (p.val > cur.val && q.val > cur.val) cur = cur.right;
        else return cur;
    }
    return null;
}
```

### Convert Sorted Array to BST
**Category:** Tier 3 · Reference
**Pattern:** Divide & conquer on midpoint  **Time:** O(n)  **Space:** O(log n)
**Approach:** Pick the middle element as the root to keep the tree height-balanced, then recursively build the left subtree from the left half and the right subtree from the right half.

<!-- Problem Statement not automatically found -->

```java
TreeNode sortedArrayToBST(int[] nums) {
    return build(nums, 0, nums.length - 1);
}
TreeNode build(int[] nums, int lo, int hi) {
    if (lo > hi) return null;
    int mid = lo + (hi - lo) / 2;
    TreeNode root = new TreeNode(nums[mid]);
    root.left = build(nums, lo, mid - 1);
    root.right = build(nums, mid + 1, hi);
    return root;
}
```

### BST Iterator
**Category:** Tier 3 · Reference
**Pattern:** Controlled inorder via stack  **Time:** O(1) amortized next/hasNext  **Space:** O(h)
**Approach:** Lazily simulate in-order traversal. Push all left nodes from a starting point; `next()` pops a node, then pushes the left spine of its right child. Each node is pushed and popped exactly once, so amortized cost is O(1).

<!-- Problem Statement not automatically found -->

```java
class BSTIterator {
    private Deque<TreeNode> st = new ArrayDeque<>();
    public BSTIterator(TreeNode root) { pushLeft(root); }
    private void pushLeft(TreeNode n) {
        while (n != null) { st.push(n); n = n.left; }
    }
    public int next() {
        TreeNode n = st.pop();
        pushLeft(n.right);
        return n.val;
    }
    public boolean hasNext() { return !st.isEmpty(); }
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
    private final Trie[] kids = new Trie[26];
    private boolean end;
    public void insert(String word) {
        Trie n = this;
        for (char c : word.toCharArray()) {
            int i = c - 'a';
            if (n.kids[i] == null) n.kids[i] = new Trie();
            n = n.kids[i];
        }
        n.end = true;
    }
    public boolean search(String word) {
        Trie n = find(word);
        return n != null && n.end;
    }
    public boolean startsWith(String prefix) {
        return find(prefix) != null;
    }
    private Trie find(String s) {
        Trie n = this;
        for (char c : s.toCharArray()) {
            n = n.kids[c - 'a'];
            if (n == null) return null;
        }
        return n;
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
    private final WordDictionary[] kids = new WordDictionary[26];
    private boolean end;
    public void addWord(String word) {
        WordDictionary n = this;
        for (char c : word.toCharArray()) {
            int i = c - 'a';
            if (n.kids[i] == null) n.kids[i] = new WordDictionary();
            n = n.kids[i];
        }
        n.end = true;
    }
    public boolean search(String word) { return dfs(word, 0, this); }
    private boolean dfs(String w, int i, WordDictionary n) {
        if (n == null) return false;
        if (i == w.length()) return n.end;
        char c = w.charAt(i);
        if (c == '.') {
            for (WordDictionary k : n.kids)
                if (dfs(w, i + 1, k)) return true;
            return false;
        }
        return dfs(w, i + 1, n.kids[c - 'a']);
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
    static class Node { Node[] kids = new Node[26]; String word; }
    public List<String> findWords(char[][] board, String[] words) {
        Node root = new Node();
        for (String w : words) {
            Node n = root;
            for (char c : w.toCharArray()) {
                int i = c - 'a';
                if (n.kids[i] == null) n.kids[i] = new Node();
                n = n.kids[i];
            }
            n.word = w;
        }
        List<String> out = new ArrayList<>();
        for (int r = 0; r < board.length; r++)
            for (int c = 0; c < board[0].length; c++)
                dfs(board, r, c, root, out);
        return out;
    }
    private void dfs(char[][] b, int r, int c, Node n, List<String> out) {
        if (r < 0 || c < 0 || r >= b.length || c >= b[0].length) return;
        char ch = b[r][c];
        if (ch == '#' || n.kids[ch - 'a'] == null) return;
        n = n.kids[ch - 'a'];
        if (n.word != null) { out.add(n.word); n.word = null; }
        b[r][c] = '#';
        dfs(b, r + 1, c, n, out);
        dfs(b, r - 1, c, n, out);
        dfs(b, r, c + 1, n, out);
        dfs(b, r, c - 1, n, out);
        b[r][c] = ch;
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
    static class Node { Node[] kids = new Node[26]; boolean end; }
    public String replaceWords(List<String> dict, String sentence) {
        Node root = new Node();
        for (String w : dict) {
            Node n = root;
            for (char c : w.toCharArray()) {
                int i = c - 'a';
                if (n.kids[i] == null) n.kids[i] = new Node();
                n = n.kids[i];
            }
            n.end = true;
        }
        String[] words = sentence.split(" ");
        StringBuilder sb = new StringBuilder();
        for (int j = 0; j < words.length; j++) {
            if (j > 0) sb.append(' ');
            sb.append(shortestRoot(root, words[j]));
        }
        return sb.toString();
    }
    private String shortestRoot(Node root, String word) {
        Node n = root;
        StringBuilder pre = new StringBuilder();
        for (char c : word.toCharArray()) {
            Node nxt = n.kids[c - 'a'];
            if (nxt == null) return word;
            pre.append(c);
            if (nxt.end) return pre.toString();
            n = nxt;
        }
        return word;
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
    PriorityQueue<Integer> heap = new PriorityQueue<>();   // min-heap
    for (int x : nums) {
        heap.offer(x);
        if (heap.size() > k) heap.poll();
    }
    return heap.peek();
}
```
**Alternative:** Quickselect — partition around a pivot targeting index `n-k`; average O(n), worst O(n^2). Recurse only into the side containing the target index instead of fully sorting.
```java
int quickselect(int[] nums, int k) {
    int target = nums.length - k, lo = 0, hi = nums.length - 1;
    Random rnd = new Random();
    while (lo < hi) {
        int p = partition(nums, lo, hi, lo + rnd.nextInt(hi - lo + 1));
        if (p == target) break;
        else if (p < target) lo = p + 1;
        else hi = p - 1;
    }
    return nums[target];
}
int partition(int[] a, int lo, int hi, int pivot) {
    int pv = a[pivot];
    swap(a, pivot, hi);
    int store = lo;
    for (int i = lo; i < hi; i++)
        if (a[i] < pv) swap(a, i, store++);
    swap(a, store, hi);
    return store;
}
void swap(int[] a, int i, int j) { int t = a[i]; a[i] = a[j]; a[j] = t; }
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
    Map<Integer, Integer> freq = new HashMap<>();
    for (int x : nums) freq.merge(x, 1, Integer::sum);
    PriorityQueue<Integer> heap =
        new PriorityQueue<>((a, b) -> freq.get(a) - freq.get(b));
    for (int key : freq.keySet()) {
        heap.offer(key);
        if (heap.size() > k) heap.poll();
    }
    int[] out = new int[k];
    for (int i = k - 1; i >= 0; i--) out[i] = heap.poll();
    return out;
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
    PriorityQueue<int[]> heap = new PriorityQueue<>(
        (a, b) -> (b[0]*b[0] + b[1]*b[1]) - (a[0]*a[0] + a[1]*a[1]));
    for (int[] p : points) {
        heap.offer(p);
        if (heap.size() > k) heap.poll();
    }
    int[][] out = new int[k][2];
    for (int i = 0; i < k; i++) out[i] = heap.poll();
    return out;
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
    private PriorityQueue<Integer> lo = new PriorityQueue<>(Collections.reverseOrder());
    private PriorityQueue<Integer> hi = new PriorityQueue<>();
    public void addNum(int num) {
        lo.offer(num);
        hi.offer(lo.poll());
        if (hi.size() > lo.size()) lo.offer(hi.poll());
    }
    public double findMedian() {
        if (lo.size() > hi.size()) return lo.peek();
        return (lo.peek() + hi.peek()) / 2.0;
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
    PriorityQueue<ListNode> heap = new PriorityQueue<>((a, b) -> a.val - b.val);
    for (ListNode l : lists) if (l != null) heap.offer(l);
    ListNode dummy = new ListNode(0), tail = dummy;
    while (!heap.isEmpty()) {
        ListNode n = heap.poll();
        tail.next = n;
        tail = n;
        if (n.next != null) heap.offer(n.next);
    }
    return dummy.next;
}
```

### Kth Smallest in a Sorted Matrix
**Category:** Tier 3 · Reference
**Pattern:** Binary search on value  **Time:** O(n log(max-min))  **Space:** O(1)
**Approach:** Each row and column is sorted, so binary search the value range. For a candidate value, count entries ≤ it by walking from the bottom-left corner in O(n). Narrow the range until lo == hi, which lands on a matrix value.

<!-- Problem Statement not automatically found -->

```java
int kthSmallest(int[][] matrix, int k) {
    int n = matrix.length;
    int lo = matrix[0][0], hi = matrix[n-1][n-1];
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (countLE(matrix, mid) < k) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}
int countLE(int[][] m, int val) {
    int n = m.length, r = n - 1, c = 0, count = 0;
    while (r >= 0 && c < n) {
        if (m[r][c] <= val) { count += r + 1; c++; }
        else r--;
    }
    return count;
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
    int[] freq = new int[26];
    int max = 0, maxCount = 0;
    for (char t : tasks) {
        freq[t - 'A']++;
        if (freq[t - 'A'] > max) { max = freq[t - 'A']; maxCount = 1; }
        else if (freq[t - 'A'] == max) maxCount++;
    }
    int slots = (max - 1) * (n + 1) + maxCount;
    return Math.max(slots, tasks.length);
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
    int[] freq = new int[26];
    for (char c : s.toCharArray()) freq[c - 'a']++;
    PriorityQueue<int[]> heap = new PriorityQueue<>((a, b) -> b[1] - a[1]); // {char, count}
    for (int i = 0; i < 26; i++)
        if (freq[i] > 0) heap.offer(new int[]{i, freq[i]});
    StringBuilder sb = new StringBuilder();
    int[] prev = null;
    while (!heap.isEmpty()) {
        int[] cur = heap.poll();
        sb.append((char) ('a' + cur[0]));
        cur[1]--;
        if (prev != null && prev[1] > 0) heap.offer(prev);
        prev = cur;
    }
    return sb.length() == s.length() ? sb.toString() : "";
}
```
