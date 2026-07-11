# 08 · Greedy & Advanced Data Structures

A reference for greedy techniques (with correctness arguments) and the heavy-duty data structures — Segment Trees, Fenwick/BIT, DSU — plus the classic O(1) design problems.

---

## How to argue greedy correctness

A greedy algorithm makes a locally optimal choice at each step and never reconsiders. To trust it you must *prove* the local choice leads to a global optimum. Two standard proof tools:

- **Exchange argument:** Take any optimal solution `OPT`. Show that if it differs from the greedy choice, you can swap (exchange) elements to make it look more like the greedy solution *without making it worse*. Repeating the exchange transforms `OPT` into the greedy solution, so greedy is at least as good. (Used for interval scheduling, Huffman, scheduling-by-deadline.)
- **Greedy-stays-ahead:** Define a measure of progress (e.g. "number of items packed so far", "rightmost reachable index"). Show by induction that after each step the greedy solution's measure is always `>=` that of any other solution. Hence greedy is never behind, so it ends optimal. (Used for Jump Game, interval covering.)

When neither holds cleanly, greedy is probably wrong — reach for DP instead.

---

## GREEDY

### Jump Game
**Category:** ⭐ Tier 1 · Core
**Pattern:** Greedy reachability (greedy-stays-ahead)  **Time:** O(n)  **Space:** O(1)
**Approach:** Track the farthest index reachable so far. Scan left to right; if the current index `i` exceeds `farthest`, we can never reach it, so return false. Otherwise extend `farthest = max(farthest, i + nums[i])`. Greedy stays ahead because the maximum reach is monotonically non-decreasing and dominates any other strategy.
```java
class Solution {
    public boolean canJump(int[] nums) {
        int farthest = 0;
        for (int i = 0; i < nums.length; i++) {
            if (i > farthest) return false;
            farthest = Math.max(farthest, i + nums[i]);
            if (farthest >= nums.length - 1) return true;
        }
        return true;
    }
}
```

### Jump Game II
**Category:** Tier 3 · Reference
**Pattern:** Greedy BFS-by-level (implicit layers)  **Time:** O(n)  **Space:** O(1)
**Approach:** Treat each "jump" as a BFS level. `curEnd` is the farthest index reachable with the current number of jumps; `farthest` is the best reach considering the current window. When `i` hits `curEnd`, we must spend a jump and advance the boundary to `farthest`. This is minimal because we only pay a jump when forced, and within a level we already considered every reachable position.
```java
class Solution {
    public int jump(int[] nums) {
        int jumps = 0, curEnd = 0, farthest = 0;
        for (int i = 0; i < nums.length - 1; i++) {
            farthest = Math.max(farthest, i + nums[i]);
            if (i == curEnd) {
                jumps++;
                curEnd = farthest;
            }
        }
        return jumps;
    }
}
```

### Gas Station
**Category:** Tier 3 · Reference
**Pattern:** Greedy with running balance + reset  **Time:** O(n)  **Space:** O(1)
**Approach:** If total gas `>=` total cost a solution exists (and is unique modulo ties). Track a running tank from a candidate start; whenever it drops below zero, no station in `[start..i]` can be a valid start (each prefix would also fail), so reset start to `i+1` and zero the tank. The single surviving start is the answer.
```java
class Solution {
    public int canCompleteCircuit(int[] gas, int[] cost) {
        int total = 0, tank = 0, start = 0;
        for (int i = 0; i < gas.length; i++) {
            int diff = gas[i] - cost[i];
            total += diff;
            tank += diff;
            if (tank < 0) {
                start = i + 1;
                tank = 0;
            }
        }
        return total >= 0 ? start : -1;
    }
}
```

### Candy
**Category:** Tier 3 · Reference
**Pattern:** Two-pass greedy (left + right constraints)  **Time:** O(n)  **Space:** O(n)
**Approach:** Each child needs at least 1 candy and more than a lower-rated neighbor. Do a left-to-right pass enforcing the left-neighbor constraint, then a right-to-left pass enforcing the right-neighbor constraint by taking the max. Each constraint is satisfied independently and the max merges them with the minimum total — neither pass can be reduced without violating a rule.
```java
class Solution {
    public int candy(int[] ratings) {
        int n = ratings.length;
        int[] candies = new int[n];
        java.util.Arrays.fill(candies, 1);
        for (int i = 1; i < n; i++)
            if (ratings[i] > ratings[i - 1])
                candies[i] = candies[i - 1] + 1;
        for (int i = n - 2; i >= 0; i--)
            if (ratings[i] > ratings[i + 1])
                candies[i] = Math.max(candies[i], candies[i + 1] + 1);
        int total = 0;
        for (int c : candies) total += c;
        return total;
    }
}
```

### Partition Labels
**Category:** Tier 3 · Reference
**Pattern:** Greedy interval merge by last occurrence  **Time:** O(n)  **Space:** O(1) (26 letters)
**Approach:** Record the last index of each character. Walk the string keeping `end = max last-index of any char seen in the current partition`. When `i == end`, every character in this window appears nowhere later, so we can cut here. This is the smallest valid cut point, maximizing the number of partitions.
```java
class Solution {
    public java.util.List<Integer> partitionLabels(String s) {
        int[] last = new int[26];
        for (int i = 0; i < s.length(); i++)
            last[s.charAt(i) - 'a'] = i;
        java.util.List<Integer> res = new java.util.ArrayList<>();
        int start = 0, end = 0;
        for (int i = 0; i < s.length(); i++) {
            end = Math.max(end, last[s.charAt(i) - 'a']);
            if (i == end) {
                res.add(end - start + 1);
                start = i + 1;
            }
        }
        return res;
    }
}
```

### Non-overlapping Intervals
**Category:** ⭐ Tier 1 · Core
**Pattern:** Interval scheduling, sort by end (exchange argument)  **Time:** O(n log n)  **Space:** O(1)
**Approach:** To keep the maximum number of non-overlapping intervals (equivalently remove the fewest), sort by end time and greedily keep an interval whenever it starts at or after the last kept end. Exchange argument: the interval ending earliest leaves the most room for the rest, so it's always safe to include it. Removals = total − kept.
```java
class Solution {
    public int eraseOverlapIntervals(int[][] intervals) {
        java.util.Arrays.sort(intervals, (a, b) -> Integer.compare(a[1], b[1]));
        int kept = 0, end = Integer.MIN_VALUE;
        for (int[] iv : intervals) {
            if (iv[0] >= end) {
                kept++;
                end = iv[1];
            }
        }
        return intervals.length - kept;
    }
}
```

### Minimum Number of Arrows to Burst Balloons
**Category:** Tier 3 · Reference
**Pattern:** Interval point cover, sort by end  **Time:** O(n log n)  **Space:** O(1)
**Approach:** Sort by end coordinate. Shoot an arrow at the end of the first balloon; it bursts every balloon overlapping that point. Skip all balloons whose start `<= arrowPos`, then shoot a new arrow at the next uncovered balloon's end. Same exchange argument as interval scheduling: the earliest end maximizes coverage. (Use `Integer.compare` to avoid overflow from `a[1]-b[1]`.)
```java
class Solution {
    public int findMinArrowShots(int[][] points) {
        java.util.Arrays.sort(points, (a, b) -> Integer.compare(a[1], b[1]));
        int arrows = 1;
        long arrowPos = points[0][1];
        for (int[] p : points) {
            if (p[0] > arrowPos) {
                arrows++;
                arrowPos = p[1];
            }
        }
        return arrows;
    }
}
```

### Assign Cookies
**Category:** Tier 3 · Reference
**Pattern:** Two-pointer greedy after sorting  **Time:** O(n log n)  **Space:** O(1)
**Approach:** Sort children by greed and cookies by size. Give the smallest cookie that can satisfy the least greedy unsatisfied child. Exchange argument: assigning the smallest sufficient cookie wastes nothing larger and never reduces how many children we can later satisfy.
```java
class Solution {
    public int findContentChildren(int[] g, int[] s) {
        java.util.Arrays.sort(g);
        java.util.Arrays.sort(s);
        int child = 0, cookie = 0;
        while (child < g.length && cookie < s.length) {
            if (s[cookie] >= g[child]) child++;
            cookie++;
        }
        return child;
    }
}
```

### Queue Reconstruction by Height
**Category:** Tier 3 · Reference
**Pattern:** Sort + insertion by k-index  **Time:** O(n^2)  **Space:** O(n)
**Approach:** Sort by height descending, breaking ties by `k` ascending. Insert each person at list index `k`. Because we process tallest first, everyone already placed is `>=` the current person, so inserting at position `k` guarantees exactly `k` taller-or-equal people stand in front — and later (shorter) insertions don't disturb that count.
```java
class Solution {
    public int[][] reconstructQueue(int[][] people) {
        java.util.Arrays.sort(people, (a, b) ->
            a[0] != b[0] ? b[0] - a[0] : a[1] - b[1]);
        java.util.List<int[]> list = new java.util.LinkedList<>();
        for (int[] p : people) list.add(p[1], p);
        return list.toArray(new int[people.length][]);
    }
}
```

### Task Scheduler (greedy framing)
**Category:** Tier 2 · Reinforce
**Pattern:** Greedy by most-frequent task + idle-slot formula  **Time:** O(n) (counting) **Space:** O(1)
**Approach:** The bottleneck is the most frequent task. Lay out its occurrences `maxCount` times separated by gaps of length `n`, creating `(maxCount-1)` frames of size `(n+1)`. Other tasks fill the gaps; only the most-frequent tasks occupy the final frame. The schedule length is `max(totalTasks, (maxCount-1)*(n+1) + numMax)` — we take the max because if there are enough distinct tasks no idle time is needed.
```java
class Solution {
    public int leastInterval(char[] tasks, int n) {
        int[] freq = new int[26];
        for (char t : tasks) freq[t - 'A']++;
        int maxCount = 0;
        for (int f : freq) maxCount = Math.max(maxCount, f);
        int numMax = 0;
        for (int f : freq) if (f == maxCount) numMax++;
        int frames = (maxCount - 1) * (n + 1) + numMax;
        return Math.max(tasks.length, frames);
    }
}
```
**Alternative:** A max-heap + cooldown queue simulation gives the same answer and also reconstructs the actual schedule if required.

---

## ADVANCED DATA STRUCTURES

### Segment Tree — Range Sum & Range Min
**Category:** 🧩 Template
**Pattern:** Recursive segment tree, point update + range query  **Time:** build O(n), query/update O(log n)  **Space:** O(n)
**Approach:** Store the array in a complete binary tree of size `~4n`. Each internal node holds the aggregate (sum or min) of its child range. `build` recurses splitting `[l,r]` at the midpoint. A range query descends only into nodes that overlap the query range, combining the aggregates of fully-covered nodes. A point update walks down to the leaf and recombines on the way back up. The combine operation (`+` for sum, `min` for min) is the only thing that changes per variant.
```java
// Range Sum segment tree (point update, range query)
class SegTreeSum {
    int[] tree;
    int n;

    SegTreeSum(int[] a) {
        n = a.length;
        tree = new int[4 * n];
        if (n > 0) build(a, 1, 0, n - 1);
    }

    private void build(int[] a, int node, int l, int r) {
        if (l == r) { tree[node] = a[l]; return; }
        int mid = (l + r) >>> 1;
        build(a, node * 2, l, mid);
        build(a, node * 2 + 1, mid + 1, r);
        tree[node] = tree[node * 2] + tree[node * 2 + 1];
    }

    // set index i to val
    void update(int i, int val) { update(1, 0, n - 1, i, val); }
    private void update(int node, int l, int r, int i, int val) {
        if (l == r) { tree[node] = val; return; }
        int mid = (l + r) >>> 1;
        if (i <= mid) update(node * 2, l, mid, i, val);
        else update(node * 2 + 1, mid + 1, r, i, val);
        tree[node] = tree[node * 2] + tree[node * 2 + 1];
    }

    // sum over [ql, qr]
    int query(int ql, int qr) { return query(1, 0, n - 1, ql, qr); }
    private int query(int node, int l, int r, int ql, int qr) {
        if (qr < l || r < ql) return 0;            // disjoint -> identity
        if (ql <= l && r <= qr) return tree[node];  // fully covered
        int mid = (l + r) >>> 1;
        return query(node * 2, l, mid, ql, qr)
             + query(node * 2 + 1, mid + 1, r, ql, qr);
    }
}

// Range Min variant: change identity to +INF and combine to Math.min
class SegTreeMin {
    int[] tree;
    int n;

    SegTreeMin(int[] a) {
        n = a.length;
        tree = new int[4 * n];
        if (n > 0) build(a, 1, 0, n - 1);
    }

    private void build(int[] a, int node, int l, int r) {
        if (l == r) { tree[node] = a[l]; return; }
        int mid = (l + r) >>> 1;
        build(a, node * 2, l, mid);
        build(a, node * 2 + 1, mid + 1, r);
        tree[node] = Math.min(tree[node * 2], tree[node * 2 + 1]);
    }

    void update(int i, int val) { update(1, 0, n - 1, i, val); }
    private void update(int node, int l, int r, int i, int val) {
        if (l == r) { tree[node] = val; return; }
        int mid = (l + r) >>> 1;
        if (i <= mid) update(node * 2, l, mid, i, val);
        else update(node * 2 + 1, mid + 1, r, i, val);
        tree[node] = Math.min(tree[node * 2], tree[node * 2 + 1]);
    }

    int query(int ql, int qr) { return query(1, 0, n - 1, ql, qr); }
    private int query(int node, int l, int r, int ql, int qr) {
        if (qr < l || r < ql) return Integer.MAX_VALUE; // identity for min
        if (ql <= l && r <= qr) return tree[node];
        int mid = (l + r) >>> 1;
        return Math.min(query(node * 2, l, mid, ql, qr),
                        query(node * 2 + 1, mid + 1, r, ql, qr));
    }
}
```

### Segment Tree — Lazy Propagation (range update + range query)
**Category:** 🧩 Template
**Pattern:** Deferred range updates  **Time:** O(log n) per op  **Space:** O(n)
**Approach:** When adding a value to an entire range, instead of touching every leaf we mark a node "lazy": apply the delta to the node's aggregate now and store the pending delta in `lazy[node]` to push down only when a later query/update needs to descend through it. `push` distributes a parent's pending delta to its two children. This keeps every range operation O(log n).
```java
class LazySegTree {
    long[] tree, lazy;
    int n;

    LazySegTree(int[] a) {
        n = a.length;
        tree = new long[4 * n];
        lazy = new long[4 * n];
        if (n > 0) build(a, 1, 0, n - 1);
    }

    private void build(int[] a, int node, int l, int r) {
        if (l == r) { tree[node] = a[l]; return; }
        int mid = (l + r) >>> 1;
        build(a, node * 2, l, mid);
        build(a, node * 2 + 1, mid + 1, r);
        tree[node] = tree[node * 2] + tree[node * 2 + 1];
    }

    // apply pending delta of node to its children (sum semantics)
    private void push(int node, int l, int r) {
        if (lazy[node] == 0) return;
        int mid = (l + r) >>> 1;
        apply(node * 2, l, mid, lazy[node]);
        apply(node * 2 + 1, mid + 1, r, lazy[node]);
        lazy[node] = 0;
    }

    private void apply(int node, int l, int r, long delta) {
        tree[node] += delta * (r - l + 1);
        lazy[node] += delta;
    }

    // add delta to every element in [ql, qr]
    void update(int ql, int qr, long delta) { update(1, 0, n - 1, ql, qr, delta); }
    private void update(int node, int l, int r, int ql, int qr, long delta) {
        if (qr < l || r < ql) return;
        if (ql <= l && r <= qr) { apply(node, l, r, delta); return; }
        push(node, l, r);
        int mid = (l + r) >>> 1;
        update(node * 2, l, mid, ql, qr, delta);
        update(node * 2 + 1, mid + 1, r, ql, qr, delta);
        tree[node] = tree[node * 2] + tree[node * 2 + 1];
    }

    long query(int ql, int qr) { return query(1, 0, n - 1, ql, qr); }
    private long query(int node, int l, int r, int ql, int qr) {
        if (qr < l || r < ql) return 0;
        if (ql <= l && r <= qr) return tree[node];
        push(node, l, r);
        int mid = (l + r) >>> 1;
        return query(node * 2, l, mid, ql, qr)
             + query(node * 2 + 1, mid + 1, r, ql, qr);
    }
}
```

### Fenwick Tree (BIT) — point update + prefix sum
**Category:** 🧩 Template
**Pattern:** Binary Indexed Tree  **Time:** update/query O(log n)  **Space:** O(n)
**Approach:** A BIT stores partial sums indexed so that `i & (-i)` (the lowest set bit) tells how large a range each slot covers. `update` adds a delta and walks *up* by `i += i & -i`; `prefixSum` accumulates by walking *down* by `i -= i & -i`. It is 1-indexed internally. Compared to a segment tree it is far less code and uses less memory, but only supports invertible aggregates (sum). Range sum `[l,r] = prefix(r) - prefix(l-1)`.
```java
class Fenwick {
    int[] bit;
    int n;

    Fenwick(int size) {
        n = size;
        bit = new int[n + 1]; // 1-indexed
    }

    // add delta at 0-based index i
    void update(int i, int delta) {
        for (int x = i + 1; x <= n; x += x & (-x))
            bit[x] += delta;
    }

    // sum of [0..i] (0-based inclusive)
    int prefixSum(int i) {
        int sum = 0;
        for (int x = i + 1; x > 0; x -= x & (-x))
            sum += bit[x];
        return sum;
    }

    // sum of [l..r] (0-based inclusive)
    int rangeSum(int l, int r) {
        return prefixSum(r) - (l > 0 ? prefixSum(l - 1) : 0);
    }
}
```

### Range Sum Query - Mutable (LeetCode 307)
**Category:** Tier 3 · Reference
**Pattern:** BIT storing deltas  **Time:** update/query O(log n)  **Space:** O(n)
**Approach:** Wrap a Fenwick tree. Keep the original values so `update(i, val)` can compute the delta `val - nums[i]` and feed it to the BIT. `sumRange` is a difference of prefix sums.
```java
class NumArray {
    int[] nums;
    int[] bit;
    int n;

    public NumArray(int[] nums) {
        this.nums = nums.clone();
        n = nums.length;
        bit = new int[n + 1];
        for (int i = 0; i < n; i++) add(i, nums[i]);
    }

    private void add(int i, int delta) {
        for (int x = i + 1; x <= n; x += x & (-x))
            bit[x] += delta;
    }

    private int prefix(int i) {
        int s = 0;
        for (int x = i + 1; x > 0; x -= x & (-x))
            s += bit[x];
        return s;
    }

    public void update(int index, int val) {
        add(index, val - nums[index]);
        nums[index] = val;
    }

    public int sumRange(int left, int right) {
        return prefix(right) - (left > 0 ? prefix(left - 1) : 0);
    }
}
```

### Count of Smaller Numbers After Self (LeetCode 315)
**Category:** Tier 3 · Reference
**Pattern:** Coordinate compression + BIT, iterate right-to-left  **Time:** O(n log n)  **Space:** O(n)
**Approach:** Compress values to ranks `1..m`. Scan from right to left; for each element query the BIT prefix sum of `rank-1` (count of already-seen elements strictly smaller, all of which lie to the right), then insert the current rank. The BIT acts as a frequency table over ranks.
```java
class Solution {
    public java.util.List<Integer> countSmaller(int[] nums) {
        int n = nums.length;
        int[] sorted = nums.clone();
        java.util.Arrays.sort(sorted);
        // rank map: value -> 1-based compressed rank (dedup)
        java.util.TreeMap<Integer, Integer> rank = new java.util.TreeMap<>();
        int r = 1;
        for (int v : sorted) if (!rank.containsKey(v)) rank.put(v, r++);

        int m = rank.size();
        int[] bit = new int[m + 1];
        Integer[] res = new Integer[n];
        for (int i = n - 1; i >= 0; i--) {
            int idx = rank.get(nums[i]);     // 1-based rank
            // count of ranks in [1, idx-1] already inserted
            int count = 0;
            for (int x = idx - 1; x > 0; x -= x & (-x)) count += bit[x];
            res[i] = count;
            for (int x = idx; x <= m; x += x & (-x)) bit[x]++;
        }
        return java.util.Arrays.asList(res);
    }
}
```
**Alternative:** A modified merge sort counts the same inversions in O(n log n) without coordinate compression.

### Reverse Pairs (LeetCode 493)
**Category:** Tier 3 · Reference
**Pattern:** BIT over compressed values, count `nums[i] > 2*nums[j]`  **Time:** O(n log n)  **Space:** O(n)
**Approach:** A reverse pair is `i < j` with `nums[i] > 2 * nums[j]`. Compress both the values and the doubled values into one sorted coordinate set. Scan left to right: for each `j`, the number of earlier `i` with `nums[i] > 2*nums[j]` equals total inserted minus the prefix count of ranks `<= rank(2*nums[j])`. Then insert `nums[j]`. Using `long` for the doubled value avoids overflow.
```java
class Solution {
    public int reversePairs(int[] nums) {
        int n = nums.length;
        // collect all coordinates: nums[i] and 2*nums[i]
        long[] coords = new long[2 * n];
        for (int i = 0; i < n; i++) {
            coords[2 * i] = nums[i];
            coords[2 * i + 1] = 2L * nums[i];
        }
        long[] sorted = coords.clone();
        java.util.Arrays.sort(sorted);
        // dedup into rank map
        java.util.TreeMap<Long, Integer> rank = new java.util.TreeMap<>();
        int r = 1;
        for (long v : sorted) if (!rank.containsKey(v)) rank.put(v, r++);
        int m = rank.size();

        int[] bit = new int[m + 1];
        int count = 0, inserted = 0;
        for (int j = 0; j < n; j++) {
            int t = rank.get(2L * nums[j]);          // rank of 2*nums[j]
            int leMeq = 0;                            // inserted with rank <= t
            for (int x = t; x > 0; x -= x & (-x)) leMeq += bit[x];
            count += inserted - leMeq;                // those strictly greater
            int idx = rank.get((long) nums[j]);
            for (int x = idx; x <= m; x += x & (-x)) bit[x]++;
            inserted++;
        }
        return count;
    }
}
```
**Alternative:** Merge sort while counting cross-pairs is the canonical alternative and avoids coordinate compression.

### DSU recap — Weighted Union-Find
**Category:** 🧩 Template
**Pattern:** Disjoint Set Union with path compression + union by rank/size  **Time:** ~O(α(n)) amortized per op  **Space:** O(n)
**Approach:** Each element points to a parent; the root identifies the set. `find` uses path compression (re-point nodes directly to the root). `union` attaches the smaller tree under the larger (union by rank or size) to keep trees shallow. Together they give near-constant amortized cost (inverse Ackermann). The size array additionally answers "how big is my component?".
```java
class DSU {
    int[] parent, rank, size;
    int components;

    DSU(int n) {
        parent = new int[n];
        rank = new int[n];
        size = new int[n];
        components = n;
        for (int i = 0; i < n; i++) {
            parent[i] = i;
            size[i] = 1;
        }
    }

    int find(int x) {
        while (parent[x] != x) {
            parent[x] = parent[parent[x]]; // path compression (halving)
            x = parent[x];
        }
        return x;
    }

    // returns false if already in same set
    boolean union(int a, int b) {
        int ra = find(a), rb = find(b);
        if (ra == rb) return false;
        // union by rank, tie-break by attaching rb under ra
        if (rank[ra] < rank[rb]) { int t = ra; ra = rb; rb = t; }
        parent[rb] = ra;
        size[ra] += size[rb];
        if (rank[ra] == rank[rb]) rank[ra]++;
        components--;
        return true;
    }

    boolean connected(int a, int b) { return find(a) == find(b); }
    int componentSize(int x) { return size[find(x)]; }
}
```

---

## DESIGN PROBLEMS

### LRU Cache (LeetCode 146)
**Category:** Tier 3 · Reference
**Pattern:** HashMap + doubly linked list  **Time:** O(1) get/put  **Space:** O(capacity)
**Approach:** A HashMap gives O(1) key→node lookup; a doubly linked list keeps usage order with the most-recently-used near the head and the least-recently-used near the tail. `get`/`put` move the touched node to the head; on overflow evict the tail. Sentinel head/tail nodes remove edge-case branches.
```java
class LRUCache {
    private static class Node {
        int key, val;
        Node prev, next;
        Node(int k, int v) { key = k; val = v; }
    }

    private final int capacity;
    private final java.util.Map<Integer, Node> map = new java.util.HashMap<>();
    private final Node head = new Node(0, 0); // MRU side
    private final Node tail = new Node(0, 0); // LRU side

    public LRUCache(int capacity) {
        this.capacity = capacity;
        head.next = tail;
        tail.prev = head;
    }

    private void remove(Node n) {
        n.prev.next = n.next;
        n.next.prev = n.prev;
    }

    private void addFront(Node n) {
        n.next = head.next;
        n.prev = head;
        head.next.prev = n;
        head.next = n;
    }

    public int get(int key) {
        Node n = map.get(key);
        if (n == null) return -1;
        remove(n);
        addFront(n);
        return n.val;
    }

    public void put(int key, int value) {
        Node n = map.get(key);
        if (n != null) {
            n.val = value;
            remove(n);
            addFront(n);
            return;
        }
        if (map.size() == capacity) {
            Node lru = tail.prev;
            remove(lru);
            map.remove(lru.key);
        }
        Node node = new Node(key, value);
        map.put(key, node);
        addFront(node);
    }
}
```

### LFU Cache (LeetCode 460)
**Category:** Tier 3 · Reference
**Pattern:** Two HashMaps + per-frequency LinkedHashSet + minFreq pointer  **Time:** O(1) get/put  **Space:** O(capacity)
**Approach:** Maintain `keyToVal`, `keyToFreq`, and `freqToKeys` (a `LinkedHashSet` per frequency preserving insertion order for LRU tie-break). Track `minFreq`. On access, bump the key's frequency by moving it from bucket `f` to `f+1`; if bucket `minFreq` becomes empty and equals the bumped freq, increment `minFreq`. On overflow evict the first (oldest) key in the `minFreq` bucket. New keys start at frequency 1, resetting `minFreq` to 1.
```java
class LFUCache {
    private final int capacity;
    private int minFreq = 0;
    private final java.util.Map<Integer, Integer> keyToVal = new java.util.HashMap<>();
    private final java.util.Map<Integer, Integer> keyToFreq = new java.util.HashMap<>();
    private final java.util.Map<Integer, java.util.LinkedHashSet<Integer>> freqToKeys =
        new java.util.HashMap<>();

    public LFUCache(int capacity) { this.capacity = capacity; }

    public int get(int key) {
        if (!keyToVal.containsKey(key)) return -1;
        touch(key);
        return keyToVal.get(key);
    }

    private void touch(int key) {
        int f = keyToFreq.get(key);
        keyToFreq.put(key, f + 1);
        freqToKeys.get(f).remove(key);
        if (freqToKeys.get(f).isEmpty()) {
            freqToKeys.remove(f);
            if (minFreq == f) minFreq++;
        }
        freqToKeys.computeIfAbsent(f + 1, k -> new java.util.LinkedHashSet<>()).add(key);
    }

    public void put(int key, int value) {
        if (capacity == 0) return;
        if (keyToVal.containsKey(key)) {
            keyToVal.put(key, value);
            touch(key);
            return;
        }
        if (keyToVal.size() >= capacity) {
            java.util.LinkedHashSet<Integer> minBucket = freqToKeys.get(minFreq);
            int evict = minBucket.iterator().next(); // oldest in lowest freq
            minBucket.remove(evict);
            if (minBucket.isEmpty()) freqToKeys.remove(minFreq);
            keyToVal.remove(evict);
            keyToFreq.remove(evict);
        }
        keyToVal.put(key, value);
        keyToFreq.put(key, 1);
        freqToKeys.computeIfAbsent(1, k -> new java.util.LinkedHashSet<>()).add(key);
        minFreq = 1;
    }
}
```

### Insert Delete GetRandom O(1) (LeetCode 380)
**Category:** Tier 3 · Reference
**Pattern:** ArrayList + HashMap with swap-to-end deletion  **Time:** O(1) avg all ops  **Space:** O(n)
**Approach:** Store values in an `ArrayList` for O(1) random access and a `HashMap` value→index for O(1) lookup. To delete, swap the target with the last element, fix the moved element's index in the map, then pop the last slot — avoiding O(n) shifting. `getRandom` indexes the list with a random position.
```java
class RandomizedSet {
    private final java.util.List<Integer> list = new java.util.ArrayList<>();
    private final java.util.Map<Integer, Integer> idx = new java.util.HashMap<>();
    private final java.util.Random rnd = new java.util.Random();

    public boolean insert(int val) {
        if (idx.containsKey(val)) return false;
        idx.put(val, list.size());
        list.add(val);
        return true;
    }

    public boolean remove(int val) {
        Integer i = idx.get(val);
        if (i == null) return false;
        int last = list.size() - 1;
        int lastVal = list.get(last);
        list.set(i, lastVal);
        idx.put(lastVal, i);
        list.remove(last);
        idx.remove(val);
        return true;
    }

    public int getRandom() {
        return list.get(rnd.nextInt(list.size()));
    }
}
```

### Time Based Key-Value Store (LeetCode 981)
**Category:** Tier 3 · Reference
**Pattern:** HashMap of (sorted) timestamp lists + binary search  **Time:** set O(1), get O(log n)  **Space:** O(n)
**Approach:** Each key maps to a list of `(timestamp, value)` appended in strictly increasing timestamp order (the problem guarantees this), so the list stays sorted. `get` binary-searches for the largest timestamp `<= query` (floor) and returns its value, or empty string if none precedes it.
```java
class TimeMap {
    private static class Entry {
        int time; String val;
        Entry(int t, String v) { time = t; val = v; }
    }

    private final java.util.Map<String, java.util.List<Entry>> map = new java.util.HashMap<>();

    public TimeMap() {}

    public void set(String key, String value, int timestamp) {
        map.computeIfAbsent(key, k -> new java.util.ArrayList<>())
           .add(new Entry(timestamp, value));
    }

    public String get(String key, int timestamp) {
        java.util.List<Entry> list = map.get(key);
        if (list == null) return "";
        int lo = 0, hi = list.size() - 1;
        String res = "";
        while (lo <= hi) {
            int mid = (lo + hi) >>> 1;
            if (list.get(mid).time <= timestamp) {
                res = list.get(mid).val;   // candidate floor
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
        return res;
    }
}
```

### Design Twitter (LeetCode 355)
**Category:** Tier 3 · Reference
**Pattern:** Follow sets + per-user tweet lists + k-way merge via heap  **Time:** getNewsFeed O(F + k log F)  **Space:** O(users + tweets)
**Approach:** Keep a global monotonically increasing timestamp on each tweet. Each user has a list of `(time, tweetId)` and a set of followees. To build a news feed, gather the latest tweets of the user and everyone they follow, then use a max-heap keyed on timestamp to pull the 10 most recent. A user implicitly follows themselves.
```java
class Twitter {
    private int time = 0;
    private final java.util.Map<Integer, java.util.List<int[]>> tweets =
        new java.util.HashMap<>(); // user -> list of {time, tweetId}
    private final java.util.Map<Integer, java.util.Set<Integer>> follows =
        new java.util.HashMap<>(); // user -> followees

    public Twitter() {}

    public void postTweet(int userId, int tweetId) {
        tweets.computeIfAbsent(userId, k -> new java.util.ArrayList<>())
              .add(new int[]{time++, tweetId});
    }

    public java.util.List<Integer> getNewsFeed(int userId) {
        // max-heap by timestamp
        java.util.PriorityQueue<int[]> pq =
            new java.util.PriorityQueue<>((a, b) -> b[0] - a[0]);
        java.util.Set<Integer> users = new java.util.HashSet<>();
        users.add(userId);
        users.addAll(follows.getOrDefault(userId, java.util.Collections.emptySet()));
        for (int u : users) {
            java.util.List<int[]> ts = tweets.get(u);
            if (ts == null) continue;
            // only the latest few per user matter; push them all (or last 10)
            for (int i = ts.size() - 1; i >= 0 && i >= ts.size() - 10; i--)
                pq.offer(ts.get(i));
        }
        java.util.List<Integer> res = new java.util.ArrayList<>();
        while (!pq.isEmpty() && res.size() < 10)
            res.add(pq.poll()[1]);
        return res;
    }

    public void follow(int followerId, int followeeId) {
        if (followerId == followeeId) return;
        follows.computeIfAbsent(followerId, k -> new java.util.HashSet<>()).add(followeeId);
    }

    public void unfollow(int followerId, int followeeId) {
        java.util.Set<Integer> set = follows.get(followerId);
        if (set != null) set.remove(followeeId);
    }
}
```
