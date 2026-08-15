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

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Jump Game](https://leetcode.com/problems/jump-game/)


You are given an integer array `nums`. You are initially positioned at the array's **first index**, and each element in the array represents your maximum jump length at that position.

Return `true`* if you can reach the last index, or *`false`* otherwise*.

 

<strong class="example">Example 1:</strong>

```text

**Input:** nums = [2,3,1,1,4]
**Output:** true
**Explanation:** Jump 1 step from index 0 to 1, then 3 steps to the last index.

```

<strong class="example">Example 2:</strong>

```text

**Input:** nums = [3,2,1,0,4]
**Output:** false
**Explanation:** You will always arrive at index 3 no matter what. Its maximum jump length is 0, which makes it impossible to reach the last index.

```

 

**Constraints:**

	- `1 <= nums.length <= 10<sup>4</sup>`

	- `0 <= nums[i] <= 10<sup>5</sup>`

</details>

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

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Jump Game II](https://leetcode.com/problems/jump-game-ii/)


You are given a **0-indexed** array of integers `nums` of length `n`. You are initially positioned at index 0.

Each element `nums[i]` represents the maximum length of a forward jump from index `i`. In other words, if you are at index `i`, you can jump to any index `(i + j)` where:

	- `0 <= j <= nums[i]` and

	- `i + j < n`

Return *the minimum number of jumps to reach index *`n - 1`. The test cases are generated such that you can reach index `n - 1`.

 

<strong class="example">Example 1:</strong>

```text

**Input:** nums = [2,3,1,1,4]
**Output:** 2
**Explanation:** The minimum number of jumps to reach the last index is 2. Jump 1 step from index 0 to 1, then 3 steps to the last index.

```

<strong class="example">Example 2:</strong>

```text

**Input:** nums = [2,3,0,1,4]
**Output:** 2

```

 

**Constraints:**

	- `1 <= nums.length <= 10<sup>4</sup>`

	- `0 <= nums[i] <= 1000`

	- It's guaranteed that you can reach `nums[n - 1]`.

</details>

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

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Gas Station](https://leetcode.com/problems/gas-station/)


There are `n` gas stations along a circular route, where the amount of gas at the `i<sup>th</sup>` station is `gas[i]`.

You have a car with an unlimited gas tank and it costs `cost[i]` of gas to travel from the `i<sup>th</sup>` station to its next `(i + 1)<sup>th</sup>` station. You begin the journey with an empty tank at one of the gas stations.

Given two integer arrays `gas` and `cost`, return *the starting gas station's index if you can travel around the circuit once in the clockwise direction, otherwise return* `-1`. If there exists a solution, it is **guaranteed** to be **unique**.

 

<strong class="example">Example 1:</strong>

```text

**Input:** gas = [1,2,3,4,5], cost = [3,4,5,1,2]
**Output:** 3
**Explanation:**
Start at station 3 (index 3) and fill up with 4 unit of gas. Your tank = 0 + 4 = 4
Travel to station 4. Your tank = 4 - 1 + 5 = 8
Travel to station 0. Your tank = 8 - 2 + 1 = 7
Travel to station 1. Your tank = 7 - 3 + 2 = 6
Travel to station 2. Your tank = 6 - 4 + 3 = 5
Travel to station 3. The cost is 5. Your gas is just enough to travel back to station 3.
Therefore, return 3 as the starting index.

```

<strong class="example">Example 2:</strong>

```text

**Input:** gas = [2,3,4], cost = [3,4,3]
**Output:** -1
**Explanation:**
You can't start at station 0 or 1, as there is not enough gas to travel to the next station.
Let's start at station 2 and fill up with 4 unit of gas. Your tank = 0 + 4 = 4
Travel to station 0. Your tank = 4 - 3 + 2 = 3
Travel to station 1. Your tank = 3 - 3 + 3 = 3
You cannot travel back to station 2, as it requires 4 unit of gas but you only have 3.
Therefore, you can't travel around the circuit once no matter where you start.

```

 

**Constraints:**

	- `n == gas.length == cost.length`

	- `1 <= n <= 10<sup>5</sup>`

	- `0 <= gas[i], cost[i] <= 10<sup>4</sup>`

	- The input is generated such that the answer is unique.

</details>

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

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Candy](https://leetcode.com/problems/candy/)


There are `n` children standing in a line.

Each child is assigned a rating value given in the integer array `ratings`.

You are giving candies to these children subjected to the following requirements:

	- Each child must have **at least** one candy.

	- Children with a **higher** rating get more candies than their neighbors.

Return the **minimum** number of candies you need to have to distribute the candies to the children.

 

<strong class="example">Example 1:</strong>

```text

**Input:** ratings = [1,0,2]
**Output:** 5
**Explanation:** You can allocate to the first, second and third child with 2, 1, 2 candies respectively.

```

<strong class="example">Example 2:</strong>

```text

**Input:** ratings = [1,2,2]
**Output:** 4
**Explanation:** You can allocate to the first, second and third child with 1, 2, 1 candies respectively.
The third child gets 1 candy because it satisfies the above two conditions.

```

 

**Constraints:**

	- `1 <= n == ratings.length <= 5 * 10<sup>4</sup>`

	- `0 <= ratings[i] <= 5 * 10<sup>4</sup>`

</details>

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

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Partition Labels](https://leetcode.com/problems/partition-labels/)


You are given a string `s`. We want to partition the string into as many parts as possible so that each letter appears in at most one part. For example, the string `"ababcc"` can be partitioned into `["abab", "cc"]`, but partitions such as `["aba", "bcc"]` or `["ab", "ab", "cc"]` are invalid.

Note that the partition is done so that after concatenating all the parts in order, the resultant string should be `s`.

Return *a list of integers representing the size of these parts*.

 

<strong class="example">Example 1:</strong>

```text

**Input:** s = "ababcbacadefegdehijhklij"
**Output:** [9,7,8]
**Explanation:**
The partition is "ababcbaca", "defegde", "hijhklij".
This is a partition so that each letter appears in at most one part.
A partition like "ababcbacadefegde", "hijhklij" is incorrect, because it splits s into less parts.

```

<strong class="example">Example 2:</strong>

```text

**Input:** s = "eccbbbbdec"
**Output:** [10]

```

 

**Constraints:**

	- `1 <= s.length <= 500`

	- `s` consists of lowercase English letters.

</details>

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

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Non-overlapping Intervals](https://leetcode.com/problems/non-overlapping-intervals/)


Given an array of intervals `intervals` where `intervals[i] = [start<sub>i</sub>, end<sub>i</sub>]`, return *the minimum number of intervals you need to remove to make the rest of the intervals non-overlapping*.

**Note** that intervals which only touch at a point are **non-overlapping**. For example, `[1, 2]` and `[2, 3]` are non-overlapping.

 

<strong class="example">Example 1:</strong>

```text

**Input:** intervals = [[1,2],[2,3],[3,4],[1,3]]
**Output:** 1
**Explanation:** [1,3] can be removed and the rest of the intervals are non-overlapping.

```

<strong class="example">Example 2:</strong>

```text

**Input:** intervals = [[1,2],[1,2],[1,2]]
**Output:** 2
**Explanation:** You need to remove two [1,2] to make the rest of the intervals non-overlapping.

```

<strong class="example">Example 3:</strong>

```text

**Input:** intervals = [[1,2],[2,3]]
**Output:** 0
**Explanation:** You don't need to remove any of the intervals since they're already non-overlapping.

```

 

**Constraints:**

	- `1 <= intervals.length <= 10<sup>5</sup>`

	- `intervals[i].length == 2`

	- `-5 * 10<sup>4</sup> <= start<sub>i</sub> < end<sub>i</sub> <= 5 * 10<sup>4</sup>`

</details>

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

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Minimum Number of Arrows to Burst Balloons](https://leetcode.com/problems/minimum-number-of-arrows-to-burst-balloons/)


There are some spherical balloons taped onto a flat wall that represents the XY-plane. The balloons are represented as a 2D integer array `points` where `points[i] = [x<sub>start</sub>, x<sub>end</sub>]` denotes a balloon whose **horizontal diameter** stretches between `x<sub>start</sub>` and `x<sub>end</sub>`. You do not know the exact y-coordinates of the balloons.

Arrows can be shot up **directly vertically** (in the positive y-direction) from different points along the x-axis. A balloon with `x<sub>start</sub>` and `x<sub>end</sub>` is **burst** by an arrow shot at `x` if `x<sub>start</sub> <= x <= x<sub>end</sub>`. There is **no limit** to the number of arrows that can be shot. A shot arrow keeps traveling up infinitely, bursting any balloons in its path.

Given the array `points`, return *the **minimum** number of arrows that must be shot to burst all balloons*.

 

<strong class="example">Example 1:</strong>

```text

**Input:** points = [[10,16],[2,8],[1,6],[7,12]]
**Output:** 2
**Explanation:** The balloons can be burst by 2 arrows:
- Shoot an arrow at x = 6, bursting the balloons [2,8] and [1,6].
- Shoot an arrow at x = 11, bursting the balloons [10,16] and [7,12].

```

<strong class="example">Example 2:</strong>

```text

**Input:** points = [[1,2],[3,4],[5,6],[7,8]]
**Output:** 4
**Explanation:** One arrow needs to be shot for each balloon for a total of 4 arrows.

```

<strong class="example">Example 3:</strong>

```text

**Input:** points = [[1,2],[2,3],[3,4],[4,5]]
**Output:** 2
**Explanation:** The balloons can be burst by 2 arrows:
- Shoot an arrow at x = 2, bursting the balloons [1,2] and [2,3].
- Shoot an arrow at x = 4, bursting the balloons [3,4] and [4,5].

```

 

**Constraints:**

	- `1 <= points.length <= 10<sup>5</sup>`

	- `points[i].length == 2`

	- `-2<sup>31</sup> <= x<sub>start</sub> < x<sub>end</sub> <= 2<sup>31</sup> - 1`

</details>

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

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Assign Cookies](https://leetcode.com/problems/assign-cookies/)


Assume you are an awesome parent and want to give your children some cookies. But, you should give each child at most one cookie.

Each child `i` has a greed factor `g[i]`, which is the minimum size of a cookie that the child will be content with; and each cookie `j` has a size `s[j]`. If `s[j] >= g[i]`, we can assign the cookie `j` to the child `i`, and the child `i` will be content. Your goal is to maximize the number of your content children and output the maximum number.

 

<strong class="example">Example 1:</strong>

```text

**Input:** g = [1,2,3], s = [1,1]
**Output:** 1
**Explanation:** You have 3 children and 2 cookies. The greed factors of 3 children are 1, 2, 3. 
And even though you have 2 cookies, since their size is both 1, you could only make the child whose greed factor is 1 content.
You need to output 1.

```

<strong class="example">Example 2:</strong>

```text

**Input:** g = [1,2], s = [1,2,3]
**Output:** 2
**Explanation:** You have 2 children and 3 cookies. The greed factors of 2 children are 1, 2. 
You have 3 cookies and their sizes are big enough to gratify all of the children, 
You need to output 2.

```

 

**Constraints:**

	- `1 <= g.length <= 3 * 10<sup>4</sup>`

	- `0 <= s.length <= 3 * 10<sup>4</sup>`

	- `1 <= g[i], s[j] <= 2<sup>31</sup> - 1`

 

**Note:** This question is the same as <a href="https://leetcode.com/problems/maximum-matching-of-players-with-trainers/description/" target="_blank"> 2410: Maximum Matching of Players With Trainers.</a>

</details>

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

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Queue Reconstruction by Height](https://leetcode.com/problems/queue-reconstruction-by-height/)


You are given an array of people, `people`, which are the attributes of some people in a queue (not necessarily in order). Each `people[i] = [h<sub>i</sub>, k<sub>i</sub>]` represents the `i<sup>th</sup>` person of height `h<sub>i</sub>` with **exactly** `k<sub>i</sub>` other people in front who have a height greater than or equal to `h<sub>i</sub>`.

Reconstruct and return *the queue that is represented by the input array *`people`. The returned queue should be formatted as an array `queue`, where `queue[j] = [h<sub>j</sub>, k<sub>j</sub>]` is the attributes of the `j<sup>th</sup>` person in the queue (`queue[0]` is the person at the front of the queue).

 

<strong class="example">Example 1:</strong>

```text

**Input:** people = [[7,0],[4,4],[7,1],[5,0],[6,1],[5,2]]
**Output:** [[5,0],[7,0],[5,2],[6,1],[4,4],[7,1]]
**Explanation:**
Person 0 has height 5 with no other people taller or the same height in front.
Person 1 has height 7 with no other people taller or the same height in front.
Person 2 has height 5 with two persons taller or the same height in front, which is person 0 and 1.
Person 3 has height 6 with one person taller or the same height in front, which is person 1.
Person 4 has height 4 with four people taller or the same height in front, which are people 0, 1, 2, and 3.
Person 5 has height 7 with one person taller or the same height in front, which is person 1.
Hence [[5,0],[7,0],[5,2],[6,1],[4,4],[7,1]] is the reconstructed queue.

```

<strong class="example">Example 2:</strong>

```text

**Input:** people = [[6,0],[5,0],[4,0],[3,2],[2,2],[1,4]]
**Output:** [[4,0],[5,0],[2,2],[3,2],[1,4],[6,0]]

```

 

**Constraints:**

	- `1 <= people.length <= 2000`

	- `0 <= h<sub>i</sub> <= 10<sup>6</sup>`

	- `0 <= k<sub>i</sub> < people.length`

	- It is guaranteed that the queue can be reconstructed.

</details>

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

<!-- Problem Statement not automatically found -->

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

<!-- Problem Statement not automatically found -->

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

<!-- Problem Statement not automatically found -->

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

<!-- Problem Statement not automatically found -->

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

<!-- Problem Statement not automatically found -->

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

<!-- Problem Statement not automatically found -->

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

<!-- Problem Statement not automatically found -->

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

<!-- Problem Statement not automatically found -->

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

<!-- Problem Statement not automatically found -->

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

<!-- Problem Statement not automatically found -->

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

<!-- Problem Statement not automatically found -->

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

<!-- Problem Statement not automatically found -->

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

<!-- Problem Statement not automatically found -->

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
