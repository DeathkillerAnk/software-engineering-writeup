# 07 · Dynamic Programming

Patterns, recurrences, and idiomatic Java for every major DP family — from 1-D Fibonacci-style problems to bitmask and tree DP.

---

## How to approach any DP

A problem is a DP candidate when it has **optimal substructure** (the answer is built from answers to smaller subproblems) and **overlapping subproblems** (the same subproblem is solved many times). Work through these steps in order:

1. **Define the state.** Decide what variables uniquely identify a subproblem. `dp[i]`, `dp[i][j]`, `dp[i][cap]`, `dp[mask]`, etc. The state is the hardest and most important part — get it wrong and nothing else works. Ask: "What is the minimal set of parameters such that the answer to this subproblem depends only on them?"
2. **Write the recurrence (transition).** Express `dp[state]` in terms of strictly smaller states. This is the "decision" at each step (take/skip, which partition point, which last element, etc.).
3. **Base cases.** The smallest states whose values you know outright (empty string, zero capacity, single element).
4. **Order of computation.** For bottom-up you must compute a state only after all states it depends on are ready. Iterate so dependencies are filled first (often increasing index, increasing length, increasing capacity).
5. **Top-down (memoization) vs bottom-up (tabulation).**
   - *Top-down:* write the recurrence as a recursive function and cache results in a memo array/map. Easy to derive directly from the recurrence; only computes reachable states; risks stack overflow on deep recursion.
   - *Bottom-up:* fill a table iteratively. No recursion overhead, easier to space-optimize, but you must reason about iteration order.
6. **Space optimization.** If `dp[i]` depends only on `dp[i-1]` (and maybe `dp[i-2]`), you can drop the full array and keep a couple of rolling variables / a single rolling row. Do this *after* you have a correct full-table solution.

A useful sanity check: the time complexity of a DP is (number of states) × (work per transition).

---

## 1-D / Fibonacci-style DP

These problems have a linear state `dp[i]` that depends on a constant number of previous states.

### Climbing Stairs
**Category:** ⭐ Tier 1 · Core
**Pattern:** 1-D Fibonacci  **Time:** O(n)  **Space:** O(1)
**Approach:** State `dp[i]` = number of distinct ways to reach step `i`. To reach step `i` you either took a single step from `i-1` or a double step from `i-2`, so `dp[i] = dp[i-1] + dp[i-2]`. Base cases `dp[0] = 1` (one way to stand at the bottom) and `dp[1] = 1`. Since each value uses only the previous two, we keep two rolling variables.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Climbing Stairs](https://leetcode.com/problems/climbing-stairs/)


You are climbing a staircase. It takes `n` steps to reach the top.

Each time you can either climb `1` or `2` steps. In how many distinct ways can you climb to the top?

 

<strong class="example">Example 1:</strong>

```text

**Input:** n = 2
**Output:** 2
**Explanation:** There are two ways to climb to the top.
1. 1 step + 1 step
2. 2 steps

```

<strong class="example">Example 2:</strong>

```text

**Input:** n = 3
**Output:** 3
**Explanation:** There are three ways to climb to the top.
1. 1 step + 1 step + 1 step
2. 1 step + 2 steps
3. 2 steps + 1 step

```

 

**Constraints:**

	- `1 <= n <= 45`

</details>

```java
public int climbStairs(int n) {
    // Base case: if n is 1 or 2, the number of ways is simply n
    // Since 1 step -> 1 way, 2 steps -> 2 ways (1+1, 2)
    if (n <= 2) return n;
    
    // We only need the last two results to compute the current one
    // prev2 holds the ways to reach (i-2), prev1 holds the ways to reach (i-1)
    int prev2 = 1, prev1 = 2; // Initialized for ways to reach step 1 and step 2
    
    // Iterate from step 3 up to the target step n
    for (int i = 3; i <= n; i++) {
        // The current ways is the sum of ways from 1 step back and 2 steps back
        int cur = prev1 + prev2;
        
        // Shift our rolling window forward for the next iteration
        // What was prev1 is now prev2
        prev2 = prev1;
        // The newly computed cur becomes our new prev1
        prev1 = cur;
    }
    
    // After reaching step n, prev1 holds the answer
    return prev1;
}
```

**Alternative (top-down memo):**
```java
public int climbStairs(int n) {
    // Initialize a memoization array of size n+1 to cache results for 0 to n
    return go(n, new int[n + 1]);
}

private int go(int n, int[] memo) {
    // Base cases: if n <= 2, we can return n (except for 0, which is 1 way to stay)
    if (n <= 2) return n == 0 ? 1 : n;
    
    // If the value is non-zero in our memo array, it means we've already computed it
    if (memo[n] != 0) return memo[n];
    
    // Compute recursively: ways to reach n-1 plus ways to reach n-2
    // Save the computed result in memo[n] before returning it to avoid redundant work
    return memo[n] = go(n - 1, memo) + go(n - 2, memo);
}
```

### House Robber
**Category:** ⭐ Tier 1 · Core
**Pattern:** 1-D pick/skip  **Time:** O(n)  **Space:** O(1)
**Approach:** State `dp[i]` = max money robbable considering houses `0..i`. At house `i` you either rob it (then you cannot rob `i-1`, giving `nums[i] + dp[i-2]`) or skip it (`dp[i-1]`). So `dp[i] = max(dp[i-1], nums[i] + dp[i-2])`. Only the last two values matter, so use two rolling variables.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [House Robber](https://leetcode.com/problems/house-robber/)


You are a professional robber planning to rob houses along a street. Each house has a certain amount of money stashed, the only constraint stopping you from robbing each of them is that adjacent houses have security systems connected and **it will automatically contact the police if two adjacent houses were broken into on the same night**.

Given an integer array `nums` representing the amount of money of each house, return *the maximum amount of money you can rob tonight **without alerting the police***.

 

<strong class="example">Example 1:</strong>

```text

**Input:** nums = [1,2,3,1]
**Output:** 4
**Explanation:** Rob house 1 (money = 1) and then rob house 3 (money = 3).
Total amount you can rob = 1 + 3 = 4.

```

<strong class="example">Example 2:</strong>

```text

**Input:** nums = [2,7,9,3,1]
**Output:** 12
**Explanation:** Rob house 1 (money = 2), rob house 3 (money = 9) and rob house 5 (money = 1).
Total amount you can rob = 2 + 9 + 1 = 12.

```

 

**Constraints:**

	- `1 <= nums.length <= 100`

	- `0 <= nums[i] <= 400`

</details>

```java
public int rob(int[] nums) {
    // prev2 tracks the max loot from houses up to i-2
    // prev1 tracks the max loot from houses up to i-1
    int prev2 = 0, prev1 = 0;
    
    // Iterate through the value of each house
    for (int num : nums) {
        // Decide whether to rob the current house
        // We either skip it (keep prev1) or rob it (prev2 + current house value)
        int cur = Math.max(prev1, prev2 + num);
        
        // Shift our DP window forward by one house
        prev2 = prev1; // prev1 becomes the new prev2
        prev1 = cur;   // our new max becomes the new prev1
    }
    
    // The final answer is stored in prev1 after processing all houses
    return prev1;
}
```

### House Robber II
**Category:** Tier 2 · Reinforce
**Pattern:** 1-D pick/skip on a circle  **Time:** O(n)  **Space:** O(1)
**Approach:** Houses are arranged in a circle, so the first and last houses are adjacent and cannot both be robbed. Split into two independent linear House Robber problems: one over `[0, n-2]` (exclude the last house) and one over `[1, n-1]` (exclude the first), then take the max. Handle the single-house edge case separately.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [House Robber II](https://leetcode.com/problems/house-robber-ii/)


You are a professional robber planning to rob houses along a street. Each house has a certain amount of money stashed. All houses at this place are **arranged in a circle.** That means the first house is the neighbor of the last one. Meanwhile, adjacent houses have a security system connected, and **it will automatically contact the police if two adjacent houses were broken into on the same night**.

Given an integer array `nums` representing the amount of money of each house, return *the maximum amount of money you can rob tonight **without alerting the police***.

 

<strong class="example">Example 1:</strong>

```text

**Input:** nums = [2,3,2]
**Output:** 3
**Explanation:** You cannot rob house 1 (money = 2) and then rob house 3 (money = 2), because they are adjacent houses.

```

<strong class="example">Example 2:</strong>

```text

**Input:** nums = [1,2,3,1]
**Output:** 4
**Explanation:** Rob house 1 (money = 1) and then rob house 3 (money = 3).
Total amount you can rob = 1 + 3 = 4.

```

<strong class="example">Example 3:</strong>

```text

**Input:** nums = [1,2,3]
**Output:** 3

```

 

**Constraints:**

	- `1 <= nums.length <= 100`

	- `0 <= nums[i] <= 1000`

</details>

```java
public int rob(int[] nums) {
    int n = nums.length;
    // Edge case: if there's only one house, we just rob it
    if (n == 1) return nums[0];
    
    // Since houses are in a circle, we can't rob both the first and last houses
    // We split into two linear problems: rob 0 to n-2, or rob 1 to n-1
    // The overall max is the maximum of these two scenarios
    return Math.max(robLine(nums, 0, n - 2), robLine(nums, 1, n - 1));
}

// Helper method to solve the linear version of House Robber
private int robLine(int[] nums, int lo, int hi) {
    // prev2 stores max money from i-2, prev1 stores max money from i-1
    int prev2 = 0, prev1 = 0;
    
    // Iterate from our given starting index 'lo' up to 'hi'
    for (int i = lo; i <= hi; i++) {
        // We either skip this house (take prev1), or rob it (take prev2 + nums[i])
        int cur = Math.max(prev1, prev2 + nums[i]);
        
        // Update variables for the next iteration
        prev2 = prev1;
        prev1 = cur;
    }
    // Return the max money for this linear stretch
    return prev1;
}
```

### Decode Ways
**Category:** Tier 3 · Reference
**Pattern:** 1-D Fibonacci with validity checks  **Time:** O(n)  **Space:** O(1)
**Approach:** State `dp[i]` = number of ways to decode the prefix of length `i`. A single digit `s[i-1]` decodes if it is `1..9`, contributing `dp[i-1]`. A two-digit number `s[i-2..i-1]` decodes if it is `10..26`, contributing `dp[i-2]`. So `dp[i] = (single valid ? dp[i-1] : 0) + (double valid ? dp[i-2] : 0)`. Base case `dp[0] = 1` (empty string has one decoding).


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Decode Ways](https://leetcode.com/problems/decode-ways/)


You have intercepted a secret message encoded as a string of numbers. The message is **decoded** via the following mapping:

<code>"1" -> 'A'<br />
"2" -> 'B'<br />
...<br />
"25" -> 'Y'<br />
"26" -> 'Z'</code>

However, while decoding the message, you realize that there are many different ways you can decode the message because some codes are contained in other codes (`"2"` and `"5"` vs `"25"`).

For example, `"11106"` can be decoded into:

	- `"AAJF"` with the grouping `(1, 1, 10, 6)`

	- `"KJF"` with the grouping `(11, 10, 6)`

	- The grouping `(1, 11, 06)` is invalid because `"06"` is not a valid code (only `"6"` is valid).

Note: there may be strings that are impossible to decode.<br />
<br />
Given a string s containing only digits, return the **number of ways** to **decode** it. If the entire string cannot be decoded in any valid way, return `0`.

The test cases are generated so that the answer fits in a **32-bit** integer.

 

<strong class="example">Example 1:</strong>

<div class="example-block">

**Input:** <span class="example-io">s = "12"</span>

**Output:** <span class="example-io">2</span>

**Explanation:**

"12" could be decoded as "AB" (1 2) or "L" (12).
</div>

<strong class="example">Example 2:</strong>

<div class="example-block">

**Input:** <span class="example-io">s = "226"</span>

**Output:** <span class="example-io">3</span>

**Explanation:**

"226" could be decoded as "BZ" (2 26), "VF" (22 6), or "BBF" (2 2 6).
</div>

<strong class="example">Example 3:</strong>

<div class="example-block">

**Input:** <span class="example-io">s = "06"</span>

**Output:** <span class="example-io">0</span>

**Explanation:**

"06" cannot be mapped to "F" because of the leading zero ("6" is different from "06"). In this case, the string is not a valid encoding, so return 0.
</div>

 

**Constraints:**

	- `1 <= s.length <= 100`

	- `s` contains only digits and may contain leading zero(s).

</details>

```java
public int numDecodings(String s) {
    // If the string starts with '0', it cannot be decoded at all
    if (s.charAt(0) == '0') return 0;
    
    // prev2 represents dp[i-2], prev1 represents dp[i-1]
    // Both are 1 initially: dp[0]=1 (empty string), dp[1]=1 (first valid character)
    int prev2 = 1, prev1 = 1; 
    
    // Iterate starting from the second character (index 2 in 1-based logic)
    for (int i = 2; i <= s.length(); i++) {
        int cur = 0; // Will hold the number of ways to decode prefix of length i
        
        // If the current digit is not '0', it can be decoded as a single letter
        if (s.charAt(i - 1) != '0') cur += prev1;        
        
        // Form a two-digit number from the previous and current characters
        int two = (s.charAt(i - 2) - '0') * 10 + (s.charAt(i - 1) - '0');
        
        // If the two-digit number is between 10 and 26, it's a valid letter
        if (two >= 10 && two <= 26) cur += prev2;         
        
        // Shift pointers for the next iteration
        prev2 = prev1;
        prev1 = cur;
    }
    // Return the result for the full string length
    return prev1;
}
```

### Min Cost Climbing Stairs
**Category:** Tier 3 · Reference
**Pattern:** 1-D Fibonacci (min)  **Time:** O(n)  **Space:** O(1)
**Approach:** State `dp[i]` = minimum cost to reach step `i` (the top is index `n`). To stand on step `i` you arrive from `i-1` or `i-2`, each costing that step's `cost` to step off: `dp[i] = min(dp[i-1] + cost[i-1], dp[i-2] + cost[i-2])`. You may start at step 0 or 1 for free, so `dp[0] = dp[1] = 0`.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Min Cost Climbing Stairs](https://leetcode.com/problems/min-cost-climbing-stairs/)


You are given an integer array `cost` where `cost[i]` is the cost of `i<sup>th</sup>` step on a staircase. Once you pay the cost, you can either climb one or two steps.

You can either start from the step with index `0`, or the step with index `1`.

Return *the minimum cost to reach the top of the floor*.

 

<strong class="example">Example 1:</strong>

```text

**Input:** cost = [10,<u>15</u>,20]
**Output:** 15
**Explanation:** You will start at index 1.
- Pay 15 and climb two steps to reach the top.
The total cost is 15.

```

<strong class="example">Example 2:</strong>

```text

**Input:** cost = [<u>1</u>,100,<u>1</u>,1,<u>1</u>,100,<u>1</u>,<u>1</u>,100,<u>1</u>]
**Output:** 6
**Explanation:** You will start at index 0.
- Pay 1 and climb two steps to reach index 2.
- Pay 1 and climb two steps to reach index 4.
- Pay 1 and climb two steps to reach index 6.
- Pay 1 and climb one step to reach index 7.
- Pay 1 and climb two steps to reach index 9.
- Pay 1 and climb one step to reach the top.
The total cost is 6.

```

 

**Constraints:**

	- `2 <= cost.length <= 1000`

	- `0 <= cost[i] <= 999`

</details>

```java
public int minCostClimbingStairs(int[] cost) {
    // prev2 is the min cost to reach i-2, prev1 is the min cost to reach i-1
    // We can start at step 0 or 1 for free, so both are 0 initially
    int prev2 = 0, prev1 = 0;
    
    // We loop up to cost.length because the "top" is the step *after* the last index
    for (int i = 2; i <= cost.length; i++) {
        // To reach i, we either come from i-1 and pay cost[i-1], 
        // or come from i-2 and pay cost[i-2]. We take the minimum.
        int cur = Math.min(prev1 + cost[i - 1], prev2 + cost[i - 2]);
        
        // Shift the DP state window forward
        prev2 = prev1;
        prev1 = cur;
    }
    // The final result is the cost to reach the top, stored in prev1
    return prev1;
}
```

---

## 0/1 Knapsack

Each item may be taken **at most once**. The state tracks which items are considered and how much capacity remains. The crucial detail when space-optimizing to 1-D: iterate capacity **backwards** so each item is used once.

### 0/1 Knapsack (template)
**Category:** 🧩 Template
**Pattern:** 0/1 Knapsack  **Time:** O(n·W)  **Space:** O(W)
**Approach:** State `dp[i][w]` = max value using the first `i` items within capacity `w`. For each item you either skip it (`dp[i-1][w]`) or take it if it fits (`val[i-1] + dp[i-1][w - wt[i-1]]`). Take the max. Space-optimize to a 1-D array `dp[w]` by iterating `w` from high to low so the value of `dp[w - wt]` still refers to the previous item (not the current one).


<!-- Problem Statement not automatically found -->

```java
public int knapsack(int[] wt, int[] val, int W) {
    // DP array to store the maximum value for each capacity up to W
    int[] dp = new int[W + 1];
    
    // Loop over each item
    for (int i = 0; i < wt.length; i++) {
        // Iterate capacity backwards from W down to the item's weight.
        // We go backwards to ensure we only use the current item i at most once.
        // If we went forwards, we might add it to a state that already included it.
        for (int w = W; w >= wt[i]; w--) {        
            // We either skip the item (dp[w]) or take it (val[i] + dp[w - wt[i]])
            dp[w] = Math.max(dp[w], val[i] + dp[w - wt[i]]);
        }
    }
    
    // The max value for capacity W is our answer
    return dp[W];
}
```

**Alternative (full 2-D table, easier to reason about):**
```java
public int knapsack2D(int[] wt, int[] val, int W) {
    int n = wt.length;
    // 2D DP array: dp[i][w] is max value using first i items within capacity w
    int[][] dp = new int[n + 1][W + 1];
    
    // Iterate through each item (1-indexed for DP state)
    for (int i = 1; i <= n; i++) {
        // Iterate through all possible capacities
        for (int w = 0; w <= W; w++) {
            // Default choice: do not include the current item i
            dp[i][w] = dp[i - 1][w];                          
            
            // If the current item's weight is less than or equal to current capacity
            if (w >= wt[i - 1])
                // We choose the max of skipping it OR including it
                dp[i][w] = Math.max(dp[i][w], val[i - 1] + dp[i - 1][w - wt[i - 1]]);
        }
    }
    // Return max value achievable with all n items and full capacity W
    return dp[n][W];
}
```

### Partition Equal Subset Sum
**Category:** ⭐ Tier 1 · Core
**Pattern:** 0/1 Knapsack (subset-sum feasibility)  **Time:** O(n·sum)  **Space:** O(sum)
**Approach:** We can split into two equal halves iff a subset sums to `total/2`. State `dp[s]` = is sum `s` achievable with some subset. Transition is the boolean knapsack: `dp[s] |= dp[s - num]`. If `total` is odd, immediately return false. Iterate the target sum backwards so each number is used once.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Partition Equal Subset Sum](https://leetcode.com/problems/partition-equal-subset-sum/)


Given an integer array `nums`, return `true` *if you can partition the array into two subsets such that the sum of the elements in both subsets is equal or *`false`* otherwise*.

 

<strong class="example">Example 1:</strong>

```text

**Input:** nums = [1,5,11,5]
**Output:** true
**Explanation:** The array can be partitioned as [1, 5, 5] and [11].

```

<strong class="example">Example 2:</strong>

```text

**Input:** nums = [1,2,3,5]
**Output:** false
**Explanation:** The array cannot be partitioned into equal sum subsets.

```

 

**Constraints:**

	- `1 <= nums.length <= 200`

	- `1 <= nums[i] <= 100`

</details>

```java
public boolean canPartition(int[] nums) {
    int total = 0;
    // Calculate the total sum of the array
    for (int n : nums) total += n;
    
    // If the sum is odd, it's impossible to split it into two equal integer halves
    if (total % 2 != 0) return false;
    
    // We want to find a subset that sums exactly to half of the total
    int target = total / 2;
    // dp[s] will be true if a subset with sum s is possible
    boolean[] dp = new boolean[target + 1];
    dp[0] = true; // A sum of 0 is always possible with an empty subset
    
    // Iterate through each number in the array
    for (int num : nums) {
        // Iterate backwards from target down to num (0/1 Knapsack optimization)
        // Backwards ensures we only use each number once
        for (int s = target; s >= num; s--) {
            // We can reach sum s if we could already reach it without this num,
            // OR if we could reach (s - num) before adding this num
            dp[s] = dp[s] || dp[s - num];
        }
    }
    
    // Return whether the exact target sum is achievable
    return dp[target];
}
```

### Target Sum
**Category:** Tier 3 · Reference
**Pattern:** 0/1 Knapsack (count subsets)  **Time:** O(n·sum)  **Space:** O(sum)
**Approach:** Assigning `+`/`-` to each number and reaching `target` is equivalent to choosing a positive subset `P` with `sum(P) = (total + target) / 2` (the rest are negative). So count subsets summing to that value. State `dp[s]` = number of subsets summing to `s`; transition `dp[s] += dp[s - num]`. The required sum must be a non-negative even split, else the answer is 0.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Target Sum](https://leetcode.com/problems/target-sum/)


You are given an integer array `nums` and an integer `target`.

You want to build an **expression** out of nums by adding one of the symbols `'+'` and `'-'` before each integer in nums and then concatenate all the integers.

	- For example, if `nums = [2, 1]`, you can add a `'+'` before `2` and a `'-'` before `1` and concatenate them to build the expression `"+2-1"`.

Return the number of different **expressions** that you can build, which evaluates to `target`.

 

<strong class="example">Example 1:</strong>

```text

**Input:** nums = [1,1,1,1,1], target = 3
**Output:** 5
**Explanation:** There are 5 ways to assign symbols to make the sum of nums be target 3.
-1 + 1 + 1 + 1 + 1 = 3
+1 - 1 + 1 + 1 + 1 = 3
+1 + 1 - 1 + 1 + 1 = 3
+1 + 1 + 1 - 1 + 1 = 3
+1 + 1 + 1 + 1 - 1 = 3

```

<strong class="example">Example 2:</strong>

```text

**Input:** nums = [1], target = 1
**Output:** 1

```

 

**Constraints:**

	- `1 <= nums.length <= 20`

	- `0 <= nums[i] <= 1000`

	- `0 <= sum(nums[i]) <= 1000`

	- `-1000 <= target <= 1000`

</details>

```java
public int findTargetSumWays(int[] nums, int target) {
    int total = 0;
    // Calculate the sum of all elements
    for (int n : nums) total += n;
    
    // The target must be achievable:
    // 1. absolute value of target cannot exceed total sum
    // 2. (total + target) must be even (required mathematically for subset partitioning)
    if (Math.abs(target) > total || (total + target) % 2 != 0) return 0;
    
    // We've reduced the problem to finding subsets that sum to exactly this value
    int subset = (total + target) / 2;
    // dp[s] will store the number of ways to reach sum s
    int[] dp = new int[subset + 1];
    dp[0] = 1; // 1 way to reach sum 0 (empty subset)
    
    // Process each number
    for (int num : nums) {
        // Iterate backwards to process each number at most once (0/1 knapsack)
        for (int s = subset; s >= num; s--) {
            // Add the ways to reach (s - num) to the ways to reach s
            dp[s] += dp[s - num];
        }
    }
    // Return the number of combinations that reach our target subset sum
    return dp[subset];
}
```

### Last Stone Weight II
**Category:** Tier 3 · Reference
**Pattern:** 0/1 Knapsack (minimize difference)  **Time:** O(n·sum)  **Space:** O(sum)
**Approach:** Smashing stones partitions them into two groups with sums `S1` and `S2`; the final stone equals `|S1 - S2|`. To minimize this, pick a subset whose sum is as close as possible to `total/2`. State `dp[s]` = is sum `s` reachable; find the largest reachable `s <= total/2`, then the answer is `total - 2*s`.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Last Stone Weight II](https://leetcode.com/problems/last-stone-weight-ii/)


You are given an array of integers `stones` where `stones[i]` is the weight of the `i<sup>th</sup>` stone.

We are playing a game with the stones. On each turn, we choose any two stones and smash them together. Suppose the stones have weights `x` and `y` with `x <= y`. The result of this smash is:

	- If `x == y`, both stones are destroyed, and

	- If `x != y`, the stone of weight `x` is destroyed, and the stone of weight `y` has new weight `y - x`.

At the end of the game, there is **at most one** stone left.

Return *the smallest possible weight of the left stone*. If there are no stones left, return `0`.

 

<strong class="example">Example 1:</strong>

```text

**Input:** stones = [2,7,4,1,8,1]
**Output:** 1
**Explanation:**
We can combine 2 and 4 to get 2, so the array converts to [2,7,1,8,1] then,
we can combine 7 and 8 to get 1, so the array converts to [2,1,1,1] then,
we can combine 2 and 1 to get 1, so the array converts to [1,1,1] then,
we can combine 1 and 1 to get 0, so the array converts to [1], then that's the optimal value.

```

<strong class="example">Example 2:</strong>

```text

**Input:** stones = [31,26,33,21,40]
**Output:** 5

```

 

**Constraints:**

	- `1 <= stones.length <= 30`

	- `1 <= stones[i] <= 100`

</details>

```java
public int lastStoneWeightII(int[] stones) {
    int total = 0;
    // Sum up all the stones' weights
    for (int s : stones) total += s;
    
    // The goal is to partition stones into two subsets whose sums are as close as possible
    int half = total / 2;
    // dp[s] represents whether a subset sum of s is reachable
    boolean[] dp = new boolean[half + 1];
    dp[0] = true; // Sum of 0 is trivially reachable
    
    // For every stone, we update the reachable sums
    for (int stone : stones) {
        // Traverse backwards to only use each stone once
        for (int s = half; s >= stone; s--) {
            // We can form sum s if we could form s before, or if we could form s - stone
            dp[s] = dp[s] || dp[s - stone];
        }
    }
    
    // Find the largest reachable sum <= half
    for (int s = half; s >= 0; s--) {
        // When we find the maximum possible sum s, the other subset has sum (total - s)
        // The difference after all smashes is (total - s) - s = total - 2s
        if (dp[s]) return total - 2 * s;
    }
    return total; // Fallback, shouldn't reach here normally
}
```

---

## Unbounded Knapsack

Each item may be taken **any number of times**. The space-optimized loop iterates capacity **forwards** so the current item can be reused within the same pass.

### Coin Change (minimum coins)
**Category:** ⭐ Tier 1 · Core
**Pattern:** Unbounded Knapsack (min)  **Time:** O(n·amount)  **Space:** O(amount)
**Approach:** State `dp[a]` = minimum number of coins to make amount `a`. For each amount, try every coin: `dp[a] = min(dp[a], dp[a - coin] + 1)`. Initialize to a sentinel "infinity" (`amount + 1`) and `dp[0] = 0`. Forward iteration over `a` lets a coin be reused. If `dp[amount]` is still the sentinel, the amount is unreachable.


<!-- Problem Statement not automatically found -->

```java
public int coinChange(int[] coins, int amount) {
    // dp array where dp[a] holds the min coins to reach amount a
    int[] dp = new int[amount + 1];
    
    // Fill with a sentinel value slightly larger than max possible coins
    Arrays.fill(dp, amount + 1);
    dp[0] = 0; // 0 coins needed to reach amount 0
    
    // Process each coin type
    for (int coin : coins) {
        // Iterate forwards because we can reuse the same coin multiple times
        // This is an unbounded knapsack pattern
        for (int a = coin; a <= amount; a++) {
            // The min coins is the smaller of what we already found, 
            // or 1 plus the min coins for the remaining amount (a - coin)
            dp[a] = Math.min(dp[a], dp[a - coin] + 1);
        }
    }
    
    // If dp[amount] is still > amount, it means it was unreachable. Return -1
    return dp[amount] > amount ? -1 : dp[amount];
}
```

### Coin Change II (count combinations)
**Category:** Tier 2 · Reinforce
**Pattern:** Unbounded Knapsack (count combinations)  **Time:** O(n·amount)  **Space:** O(amount)
**Approach:** State `dp[a]` = number of **combinations** summing to `a`. Transition `dp[a] += dp[a - coin]`. The coin loop must be the **outer** loop so combinations are counted regardless of order (each coin type is fully processed before moving on), which avoids counting `1+2` and `2+1` as distinct. Base case `dp[0] = 1` (the empty combination).


<!-- Problem Statement not automatically found -->

```java
public int change(int amount, int[] coins) {
    // dp[a] will store the total number of combinations to make amount a
    int[] dp = new int[amount + 1];
    dp[0] = 1; // Base case: 1 way to make amount 0 (use no coins)
    
    // By keeping the coin loop on the outside, we enforce an order on the coins used
    // This ensures we count combinations (e.g., 1+2), not permutations (1+2 vs 2+1)
    for (int coin : coins) {            
        // Iterate forwards since we can use each coin multiple times
        for (int a = coin; a <= amount; a++) {
            // Add the combinations that form (a - coin)
            dp[a] += dp[a - coin];
        }
    }
    
    // The last element stores the answer for the full amount
    return dp[amount];
}
```

### Combination Sum IV
**Category:** Tier 3 · Reference
**Pattern:** Unbounded Knapsack (count permutations)  **Time:** O(n·target)  **Space:** O(target)
**Approach:** Here different orderings count as distinct, so we count **permutations**. State `dp[t]` = number of ordered sequences summing to `t`, with `dp[t] += dp[t - num]`. The target loop is **outer** and the numbers loop is inner — the mirror image of Coin Change II — because at each total we consider every possible last element. Use `long` accumulation to avoid overflow if intermediate counts are large.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Combination Sum IV](https://leetcode.com/problems/combination-sum-iv/)


Given an array of **distinct** integers `nums` and a target integer `target`, return *the number of possible combinations that add up to* `target`.

The test cases are generated so that the answer can fit in a **32-bit** integer.

 

<strong class="example">Example 1:</strong>

```text

**Input:** nums = [1,2,3], target = 4
**Output:** 7
**Explanation:**
The possible combination ways are:
(1, 1, 1, 1)
(1, 1, 2)
(1, 2, 1)
(1, 3)
(2, 1, 1)
(2, 2)
(3, 1)
Note that different sequences are counted as different combinations.

```

<strong class="example">Example 2:</strong>

```text

**Input:** nums = [9], target = 3
**Output:** 0

```

 

**Constraints:**

	- `1 <= nums.length <= 200`

	- `1 <= nums[i] <= 1000`

	- All the elements of `nums` are **unique**.

	- `1 <= target <= 1000`

 

**Follow up:** What if negative numbers are allowed in the given array? How does it change the problem? What limitation we need to add to the question to allow negative numbers?

</details>

```java
public int combinationSum4(int[] nums, int target) {
    // dp[t] stores the number of valid sequences that sum up to t
    int[] dp = new int[target + 1];
    dp[0] = 1; // 1 way to reach sum 0
    
    // The target loop is on the outside. This allows us to try every number 
    // at each step, effectively counting permutations rather than combinations.
    for (int t = 1; t <= target; t++) {     
        // Check every available number
        for (int num : nums) {
            // If the number fits into our current target t, add its ways
            if (t >= num) dp[t] += dp[t - num];
        }
    }
    
    // dp[target] now has total permutations summing to target
    return dp[target];
}
```

### Rod Cutting
**Category:** Tier 3 · Reference
**Pattern:** Unbounded Knapsack (max value)  **Time:** O(n²)  **Space:** O(n)
**Approach:** Given prices for each length `1..n`, state `dp[len]` = max revenue obtainable from a rod of length `len`. Make the first cut of size `i` (revenue `price[i-1]`) and recurse on the remainder: `dp[len] = max over i of price[i-1] + dp[len - i]`. Pieces are reusable, so this is unbounded knapsack with weight = length and value = price.


<!-- Problem Statement not automatically found -->

```java
public int rodCutting(int[] price, int n) {
    // price[i] is the value of a piece of length i+1
    // dp[len] will store the max revenue for a rod of length len
    int[] dp = new int[n + 1];
    
    // Calculate max revenue for each length from 1 up to n
    for (int len = 1; len <= n; len++) {
        // Try making the first cut of every possible size i
        for (int i = 1; i <= len; i++) {
            // Revenue is the price of the cut piece plus max revenue of the remaining rod
            // Update dp[len] to keep track of the maximum revenue found
            dp[len] = Math.max(dp[len], price[i - 1] + dp[len - i]);
        }
    }
    
    // Return max revenue for rod of length n
    return dp[n];
}
```

---

## Subsequence DP

These operate on one or two sequences, with state indexing positions in those sequences.

### Longest Increasing Subsequence
**Category:** ⭐ Tier 1 · Core
**Pattern:** Subsequence DP  **Time:** O(n²) or O(n log n)  **Space:** O(n)
**Approach (O(n²)):** State `dp[i]` = length of the longest strictly increasing subsequence ending exactly at index `i`. For each `i`, look at every `j < i` with `nums[j] < nums[i]` and take `dp[i] = max(dp[i], dp[j] + 1)`. The answer is the max over all `dp[i]`.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Longest Increasing Subsequence](https://leetcode.com/problems/longest-increasing-subsequence/)


Given an integer array `nums`, return *the length of the longest **strictly increasing ***<span data-keyword="subsequence-array">***subsequence***</span>.

 

<strong class="example">Example 1:</strong>

```text

**Input:** nums = [10,9,2,5,3,7,101,18]
**Output:** 4
**Explanation:** The longest increasing subsequence is [2,3,7,101], therefore the length is 4.

```

<strong class="example">Example 2:</strong>

```text

**Input:** nums = [0,1,0,3,2,3]
**Output:** 4

```

<strong class="example">Example 3:</strong>

```text

**Input:** nums = [7,7,7,7,7,7,7]
**Output:** 1

```

 

**Constraints:**

	- `1 <= nums.length <= 2500`

	- `-10<sup>4</sup> <= nums[i] <= 10<sup>4</sup>`

 

**Follow up:** Can you come up with an algorithm that runs in `O(n log(n))` time complexity?

</details>

```java
public int lengthOfLIS(int[] nums) {
    int n = nums.length, best = 1;
    // dp[i] will store the length of the longest increasing subsequence ending at index i
    int[] dp = new int[n];
    
    // Each single element is a valid subsequence of length 1
    Arrays.fill(dp, 1);
    
    // Iterate through the array starting from the second element
    for (int i = 1; i < n; i++) {
        // Look back at all previous elements
        for (int j = 0; j < i; j++) {
            // If the previous element is smaller, we can append nums[i] to its subsequence
            if (nums[j] < nums[i]) {
                // Update dp[i] if appending to dp[j] gives a longer subsequence
                dp[i] = Math.max(dp[i], dp[j] + 1);
            }
        }
        // Keep track of the maximum length found so far
        best = Math.max(best, dp[i]);
    }
    return best;
}
```

**Alternative (O(n log n) patience sorting):** Maintain `tails`, where `tails[k]` is the smallest possible tail of an increasing subsequence of length `k+1`. For each number, binary-search the first tail `>= num` and replace it (or append if none). The length of `tails` is the LIS length. `tails` is not a real subsequence, but its size is correct.
```java
public int lengthOfLIS(int[] nums) {
    // tails array stores the smallest tail of all increasing subsequences of length i+1
    int[] tails = new int[nums.length];
    int size = 0; // Current maximum length of an increasing subsequence
    
    for (int num : nums) {
        // We use binary search to find the insertion point for 'num' in 'tails'
        int lo = 0, hi = size;
        while (lo < hi) {                 
            int mid = (lo + hi) >>> 1;
            // If tails[mid] is smaller, num must go further to the right
            if (tails[mid] < num) lo = mid + 1;
            // Otherwise, num can replace tails[mid] or something to the left
            else hi = mid;
        }
        
        // Replace the element at 'lo' with 'num'. 
        // This keeps the tails values as small as possible, allowing for easier extensions later.
        tails[lo] = num;
        
        // If we appended to the end, the longest subsequence length increases
        if (lo == size) size++;
    }
    
    // The size of the tails array tells us the length of the longest increasing subsequence
    return size;
}
```

### Longest Common Subsequence
**Category:** ⭐ Tier 1 · Core
**Pattern:** Two-sequence DP  **Time:** O(m·n)  **Space:** O(min(m,n)) optimizable
**Approach:** State `dp[i][j]` = LCS length of `a[0..i)` and `b[0..j)`. If the last characters match, extend the diagonal: `dp[i][j] = dp[i-1][j-1] + 1`. Otherwise drop one character: `dp[i][j] = max(dp[i-1][j], dp[i][j-1])`. Base row/column are zero (empty string).


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Longest Common Subsequence](https://leetcode.com/problems/longest-common-subsequence/)


Given two strings `text1` and `text2`, return *the length of their longest **common subsequence**. *If there is no **common subsequence**, return `0`.

A **subsequence** of a string is a new string generated from the original string with some characters (can be none) deleted without changing the relative order of the remaining characters.

	- For example, `"ace"` is a subsequence of `"abcde"`.

A **common subsequence** of two strings is a subsequence that is common to both strings.

 

<strong class="example">Example 1:</strong>

```text

**Input:** text1 = "abcde", text2 = "ace" 
**Output:** 3  
**Explanation:** The longest common subsequence is "ace" and its length is 3.

```

<strong class="example">Example 2:</strong>

```text

**Input:** text1 = "abc", text2 = "abc"
**Output:** 3
**Explanation:** The longest common subsequence is "abc" and its length is 3.

```

<strong class="example">Example 3:</strong>

```text

**Input:** text1 = "abc", text2 = "def"
**Output:** 0
**Explanation:** There is no such common subsequence, so the result is 0.

```

 

**Constraints:**

	- `1 <= text1.length, text2.length <= 1000`

	- `text1` and `text2` consist of only lowercase English characters.

</details>

```java
public int longestCommonSubsequence(String a, String b) {
    int m = a.length(), n = b.length();
    // dp[i][j] stores the LCS length for a[0..i-1] and b[0..j-1]
    int[][] dp = new int[m + 1][n + 1];
    
    // Loop over the first string
    for (int i = 1; i <= m; i++) {
        // Loop over the second string
        for (int j = 1; j <= n; j++) {
            // If the characters match, they are part of the LCS
            // So we add 1 to the LCS of the prefixes without these characters
            if (a.charAt(i - 1) == b.charAt(j - 1))
                dp[i][j] = dp[i - 1][j - 1] + 1;
            // If they don't match, the LCS is the max of dropping the current char from a or from b
            else
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
    }
    
    // The answer for the full strings is in dp[m][n]
    return dp[m][n];
}
```

### Edit Distance
**Category:** ⭐ Tier 1 · Core
**Pattern:** Two-sequence DP  **Time:** O(m·n)  **Space:** O(m·n)
**Approach:** State `dp[i][j]` = minimum operations (insert/delete/replace) to turn `a[0..i)` into `b[0..j)`. If the last chars match, no cost: `dp[i][j] = dp[i-1][j-1]`. Otherwise take `1 + min` of replace (`dp[i-1][j-1]`), delete (`dp[i-1][j]`), insert (`dp[i][j-1]`). Base cases: converting to/from an empty string costs that string's length.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Edit Distance](https://leetcode.com/problems/edit-distance/)


Given two strings `word1` and `word2`, return *the minimum number of operations required to convert `word1` to `word2`*.

You have the following three operations permitted on a word:

	- Insert a character

	- Delete a character

	- Replace a character

 

<strong class="example">Example 1:</strong>

```text

**Input:** word1 = "horse", word2 = "ros"
**Output:** 3
**Explanation:** 
horse -> rorse (replace 'h' with 'r')
rorse -> rose (remove 'r')
rose -> ros (remove 'e')

```

<strong class="example">Example 2:</strong>

```text

**Input:** word1 = "intention", word2 = "execution"
**Output:** 5
**Explanation:** 
intention -> inention (remove 't')
inention -> enention (replace 'i' with 'e')
enention -> exention (replace 'n' with 'x')
exention -> exection (replace 'n' with 'c')
exection -> execution (insert 'u')

```

 

**Constraints:**

	- `0 <= word1.length, word2.length <= 500`

	- `word1` and `word2` consist of lowercase English letters.

</details>

```java
public int minDistance(String a, String b) {
    int m = a.length(), n = b.length();
    // dp[i][j] stores the min operations to convert a[0..i-1] to b[0..j-1]
    int[][] dp = new int[m + 1][n + 1];
    
    // Base cases: converting string 'a' of length i to an empty string requires i deletions
    for (int i = 0; i <= m; i++) dp[i][0] = i;   
    // Converting an empty string to string 'b' of length j requires j insertions
    for (int j = 0; j <= n; j++) dp[0][j] = j;   
    
    for (int i = 1; i <= m; i++) {
        for (int j = 1; j <= n; j++) {
            // If the characters are the same, no operation is needed
            // We just inherit the cost from the prefixes
            if (a.charAt(i - 1) == b.charAt(j - 1))
                dp[i][j] = dp[i - 1][j - 1];
            else {
                // If they differ, we consider all three operations and take the min cost:
                // dp[i-1][j-1]: replace character in 'a' to match 'b'
                // dp[i-1][j]: delete character from 'a'
                // dp[i][j-1]: insert character into 'a' to match 'b'
                dp[i][j] = 1 + Math.min(dp[i - 1][j - 1],
                              Math.min(dp[i - 1][j], dp[i][j - 1]));
            }
        }
    }
    return dp[m][n];
}
```

### Distinct Subsequences
**Category:** Tier 3 · Reference
**Pattern:** Two-sequence DP (count)  **Time:** O(m·n)  **Space:** O(n)
**Approach:** State `dp[i][j]` = number of times `t[0..j)` appears as a subsequence of `s[0..i)`. We always have the option to skip `s[i-1]`: `dp[i][j] = dp[i-1][j]`. If `s[i-1] == t[j-1]` we may also match it, adding `dp[i-1][j-1]`. Base: `dp[i][0] = 1` (empty `t` matches once). Space-optimize to 1-D by iterating `j` backwards.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Distinct Subsequences](https://leetcode.com/problems/distinct-subsequences/)


Given two strings s and t, return *the number of distinct* ***subsequences**** of *s* which equals *t.

The test cases are generated so that the answer fits on a 32-bit signed integer.

 

<strong class="example">Example 1:</strong>

```text

**Input:** s = "rabbbit", t = "rabbit"
**Output:** 3
**Explanation:**
As shown below, there are 3 ways you can generate "rabbit" from s.
`**<u>rabb</u>**b**<u>it</u>**`
`**<u>ra</u>**b**<u>bbit</u>**`
`**<u>rab</u>**b**<u>bit</u>**`

```

<strong class="example">Example 2:</strong>

```text

**Input:** s = "babgbag", t = "bag"
**Output:** 5
**Explanation:**
As shown below, there are 5 ways you can generate "bag" from s.
`**<u>ba</u>**b<u>**g**</u>bag`
`**<u>ba</u>**bgba**<u>g</u>**`
`<u>**b**</u>abgb**<u>ag</u>**`
`ba<u>**b**</u>gb<u>**ag**</u>`
`babg**<u>bag</u>**`
```

 

**Constraints:**

	- `1 <= s.length, t.length <= 1000`

	- `s` and `t` consist of English letters.

</details>

```java
public int numDistinct(String s, String t) {
    int n = t.length();
    // dp array where dp[j] stores the number of distinct subsequences matching t[0..j-1]
    long[] dp = new long[n + 1];
    
    // Base case: an empty string 't' can be matched exactly once by deleting all chars in 's'
    dp[0] = 1;
    
    // Iterate over each character in string s
    for (int i = 1; i <= s.length(); i++) {
        // Iterate backwards over string t to avoid reusing the same character from s
        for (int j = n; j >= 1; j--) {        
            // If the current character in s matches the current character in t
            // we can either use it to match t[j-1] (adds dp[j-1] ways) 
            // or choose to ignore it (which is the old value of dp[j])
            if (s.charAt(i - 1) == t.charAt(j - 1)) {
                dp[j] += dp[j - 1];
            }
        }
    }
    
    // Return the number of ways to match the entire string t
    return (int) dp[n];
}
```

### Longest Palindromic Subsequence
**Category:** Tier 3 · Reference
**Pattern:** Interval / subsequence DP  **Time:** O(n²)  **Space:** O(n²)
**Approach:** State `dp[i][j]` = length of the longest palindromic subsequence within `s[i..j]`. If the ends match, they wrap an inner palindrome: `dp[i][j] = dp[i+1][j-1] + 2`. Otherwise drop one end: `dp[i][j] = max(dp[i+1][j], dp[i][j-1])`. Single characters are palindromes of length 1. Iterate `i` from high to low (so `i+1` is ready) and `j` from `i+1` up.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Longest Palindromic Subsequence](https://leetcode.com/problems/longest-palindromic-subsequence/)


Given a string `s`, find *the longest palindromic **subsequence**'s length in* `s`.

A **subsequence** is a sequence that can be derived from another sequence by deleting some or no elements without changing the order of the remaining elements.

 

<strong class="example">Example 1:</strong>

```text

**Input:** s = "bbbab"
**Output:** 4
**Explanation:** One possible longest palindromic subsequence is "bbbb".

```

<strong class="example">Example 2:</strong>

```text

**Input:** s = "cbbd"
**Output:** 2
**Explanation:** One possible longest palindromic subsequence is "bb".

```

 

**Constraints:**

	- `1 <= s.length <= 1000`

	- `s` consists only of lowercase English letters.

</details>

```java
public int longestPalindromeSubseq(String s) {
    int n = s.length();
    // dp[i][j] represents the length of the longest palindromic subsequence in s[i..j]
    int[][] dp = new int[n][n];
    
    // Process the intervals from shortest to longest
    // We iterate i backwards so that dp[i+1] is already computed when we need it
    for (int i = n - 1; i >= 0; i--) {
        // Every single character is a palindrome of length 1
        dp[i][i] = 1;
        
        // Check all substrings starting at i and ending at j
        for (int j = i + 1; j < n; j++) {
            // If the ends match, they can wrap the longest palindrome of the inner substring
            if (s.charAt(i) == s.charAt(j))
                dp[i][j] = dp[i + 1][j - 1] + 2;
            // If they don't match, we take the max of dropping the left char or dropping the right char
            else
                dp[i][j] = Math.max(dp[i + 1][j], dp[i][j - 1]);
        }
    }
    
    // The result for the whole string is stored in dp[0][n-1]
    return dp[0][n - 1];
}
```

---

## Interval DP

The state is an interval `[i, j]`; transitions pick a split point or a "last action" inside the interval. Iterate by increasing interval length.

### Burst Balloons
**Category:** Tier 3 · Reference
**Pattern:** Interval DP (last to burst)  **Time:** O(n³)  **Space:** O(n²)
**Approach:** Pad the array with virtual `1`s at both ends. State `dp[i][j]` = max coins from bursting all balloons strictly between `i` and `j`. The trick: choose `k` as the **last** balloon burst in `(i, j)`; at that moment its neighbors are exactly `i` and `j`, giving `nums[i]*nums[k]*nums[j]`, plus the independently-solved left `dp[i][k]` and right `dp[k][j]`. Maximize over `k`.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Burst Balloons](https://leetcode.com/problems/burst-balloons/)


You are given `n` balloons, indexed from `0` to `n - 1`. Each balloon is painted with a number on it represented by an array `nums`. You are asked to burst all the balloons.

If you burst the `i<sup>th</sup>` balloon, you will get `nums[i - 1] * nums[i] * nums[i + 1]` coins. If `i - 1` or `i + 1` goes out of bounds of the array, then treat it as if there is a balloon with a `1` painted on it.

Return *the maximum coins you can collect by bursting the balloons wisely*.

 

<strong class="example">Example 1:</strong>

```text

**Input:** nums = [3,1,5,8]
**Output:** 167
**Explanation:**
nums = [3,1,5,8] --> [3,5,8] --> [3,8] --> [8] --> []
coins =  3*1*5    +   3*5*8   +  1*3*8  + 1*8*1 = 167
```

<strong class="example">Example 2:</strong>

```text

**Input:** nums = [1,5]
**Output:** 10

```

 

**Constraints:**

	- `n == nums.length`

	- `1 <= n <= 300`

	- `0 <= nums[i] <= 100`

</details>

```java
public int maxCoins(int[] nums) {
    int n = nums.length;
    // Create a new array 'a' with padded 1s at both ends to handle boundary balloons
    int[] a = new int[n + 2];
    a[0] = a[n + 1] = 1;
    for (int i = 0; i < n; i++) a[i + 1] = nums[i];
    
    // dp[i][j] will store the max coins obtained by bursting all balloons strictly between i and j
    int[][] dp = new int[n + 2][n + 2];
    
    // Iterate over interval lengths (len is the distance between i and j)
    for (int len = 2; len <= n + 1; len++) {      
        // Iterate over the start index of the interval
        for (int i = 0; i + len <= n + 1; i++) {
            int j = i + len; // End index of the interval
            
            // Try making every balloon k (between i and j) the LAST one to be burst
            for (int k = i + 1; k < j; k++) {      
                // When k is the last balloon, its adjacent balloons are exactly i and j
                // We add the coins from bursting k to the best scores from the independent left and right subarrays
                dp[i][j] = Math.max(dp[i][j],
                    a[i] * a[k] * a[j] + dp[i][k] + dp[k][j]);
            }
        }
    }
    // The max coins for bursting everything between the padded boundaries 0 and n+1
    return dp[0][n + 1];
}
```

### Matrix Chain Multiplication
**Category:** Tier 3 · Reference
**Pattern:** Interval DP (split point)  **Time:** O(n³)  **Space:** O(n²)
**Approach:** Given dimensions `p[0..n]` where matrix `i` is `p[i-1] × p[i]`, state `dp[i][j]` = min scalar multiplications to multiply matrices `i..j`. Try every split `k` where the last multiplication joins the products of `i..k` and `k+1..j`, costing `p[i-1]*p[k]*p[j]`: `dp[i][j] = min over k of dp[i][k] + dp[k+1][j] + p[i-1]*p[k]*p[j]`. Single matrices cost 0.


<!-- Problem Statement not automatically found -->

```java
public int matrixChainOrder(int[] p) {
    int n = p.length - 1;                  // The actual number of matrices
    // dp[i][j] is the min scalar multiplications needed to multiply matrices i through j
    int[][] dp = new int[n + 1][n + 1];
    
    // 'len' is the chain length we are solving for
    for (int len = 2; len <= n; len++) {
        // Iterate through all possible starting matrices i
        for (int i = 1; i + len - 1 <= n; i++) {
            // j is the ending matrix for the current chain
            int j = i + len - 1;
            dp[i][j] = Integer.MAX_VALUE; // Initialize to infinity
            
            // k is the split point: we multiply (A_i...A_k) with (A_{k+1}...A_j)
            for (int k = i; k < j; k++) {
                // Cost = cost of left group + cost of right group + cost to multiply the two resulting matrices
                // Left group dimensions: p[i-1] x p[k]. Right group: p[k] x p[j]. 
                int cost = dp[i][k] + dp[k + 1][j] + p[i - 1] * p[k] * p[j];
                // Keep the minimum cost found
                dp[i][j] = Math.min(dp[i][j], cost);
            }
        }
    }
    
    // Return the optimal cost to multiply all n matrices
    return dp[1][n];
}
```

### Palindrome Partitioning II
**Category:** Tier 3 · Reference
**Pattern:** Interval precompute + 1-D DP  **Time:** O(n²)  **Space:** O(n²)
**Approach:** We want the minimum cuts to split `s` into palindromes. First precompute `pal[i][j]` = whether `s[i..j]` is a palindrome (interval DP: `s[i]==s[j]` and inner is palindrome). Then `cut[i]` = min cuts for prefix `s[0..i)`: if `s[0..i)` is itself a palindrome, `cut[i] = 0`; otherwise `cut[i] = min over j of cut[j] + 1` where `s[j..i)` is a palindrome.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Palindrome Partitioning II](https://leetcode.com/problems/palindrome-partitioning-ii/)


Given a string `s`, partition `s` such that every <span data-keyword="substring-nonempty">substring</span> of the partition is a <span data-keyword="palindrome-string">palindrome</span>.

Return *the **minimum** cuts needed for a palindrome partitioning of* `s`.

 

<strong class="example">Example 1:</strong>

```text

**Input:** s = "aab"
**Output:** 1
**Explanation:** The palindrome partitioning ["aa","b"] could be produced using 1 cut.

```

<strong class="example">Example 2:</strong>

```text

**Input:** s = "a"
**Output:** 0

```

<strong class="example">Example 3:</strong>

```text

**Input:** s = "ab"
**Output:** 1

```

 

**Constraints:**

	- `1 <= s.length <= 2000`

	- `s` consists of lowercase English letters only.

</details>

```java
public int minCut(String s) {
    int n = s.length();
    // pal[i][j] will be true if s[i..j] is a palindrome
    boolean[][] pal = new boolean[n][n];
    
    // First, precompute all palindromic substrings using Interval DP
    for (int i = n - 1; i >= 0; i--) {
        for (int j = i; j < n; j++) {
            // It is a palindrome if outer characters match AND the inner substring is a palindrome
            // (or length is less than 3, so there is no inner substring to worry about)
            if (s.charAt(i) == s.charAt(j) && (j - i < 2 || pal[i + 1][j - 1]))
                pal[i][j] = true;
        }
    }
    
    // cut[i] will store the minimum cuts needed for the prefix s[0..i-1]
    int[] cut = new int[n + 1];
    for (int i = 1; i <= n; i++) {
        // Worst case: we need a cut between every single character (i chars -> i-1 cuts)
        cut[i] = i - 1;                       
        
        // Try every possible last palindrome piece s[j..i-1]
        for (int j = 0; j < i; j++) {
            // If the piece s[j..i-1] is a valid palindrome
            if (pal[j][i - 1]) {
                // The cuts needed is the cuts for s[0..j-1] + 1 (for this new piece)
                // If j == 0, the whole prefix is a palindrome, so 0 cuts needed.
                cut[i] = Math.min(cut[i], (j == 0 ? 0 : cut[j] + 1));
            }
        }
    }
    // Return the minimum cuts for the entire string of length n
    return cut[n];
}
```

---

## Grid DP

The state is a cell `(r, c)`; transitions come from adjacent cells (usually top and left). Many of these collapse to a single rolling row.

### Unique Paths
**Category:** ⭐ Tier 1 · Core
**Pattern:** Grid DP (count)  **Time:** O(m·n)  **Space:** O(n)
**Approach:** A robot moves only right or down from top-left to bottom-right. State `dp[c]` = number of ways to reach the current row's column `c`. Each cell is reached from above (`dp[c]`, the value before update = the cell above) plus from the left (`dp[c-1]`): `dp[c] += dp[c-1]`. The first column is always 1 (only one way: straight down).


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Unique Paths](https://leetcode.com/problems/unique-paths/)


There is a robot on an `m x n` grid. The robot is initially located at the **top-left corner** (i.e., `grid[0][0]`). The robot tries to move to the **bottom-right corner** (i.e., `grid[m - 1][n - 1]`). The robot can only move either down or right at any point in time.

Given the two integers `m` and `n`, return *the number of possible unique paths that the robot can take to reach the bottom-right corner*.

The test cases are generated so that the answer will be less than or equal to `2 * 10<sup>9</sup>`.

 

<strong class="example">Example 1:</strong>
<img src="https://assets.leetcode.com/uploads/2018/10/22/robot_maze.png" style="width: 400px; height: 183px;" />

```text

**Input:** m = 3, n = 7
**Output:** 28

```

<strong class="example">Example 2:</strong>

```text

**Input:** m = 3, n = 2
**Output:** 3
**Explanation:** From the top-left corner, there are a total of 3 ways to reach the bottom-right corner:
1. Right -> Down -> Down
2. Down -> Down -> Right
3. Down -> Right -> Down

```

 

**Constraints:**

	- `1 <= m, n <= 100`

</details>

```java
public int uniquePaths(int m, int n) {
    // dp[c] represents the number of ways to reach column c in the current row
    int[] dp = new int[n];
    
    // Fill the first row with 1s, since there's only 1 way to reach any cell 
    // in the first row (by strictly moving right)
    Arrays.fill(dp, 1);
    
    // Process each row starting from the second one (row index 1)
    for (int r = 1; r < m; r++) {
        // Process each column starting from the second one
        for (int c = 1; c < n; c++) {
            // The number of ways to reach cell (r, c) is the sum of ways to reach 
            // the cell directly above it (which is currently stored in dp[c]) 
            // and the cell to its left (which is dp[c - 1])
            dp[c] += dp[c - 1];               
        }
    }
    // After processing all rows, the last element holds the answer for bottom-right
    return dp[n - 1];
}
```

### Unique Paths II
**Category:** Tier 2 · Reinforce
**Pattern:** Grid DP (count with obstacles)  **Time:** O(m·n)  **Space:** O(n)
**Approach:** Same as Unique Paths but obstacle cells (value 1) have zero paths. State `dp[c]` = ways to reach column `c` in the current row; set it to 0 at obstacles, otherwise `dp[c] += dp[c-1]`. Initialize `dp[0] = 1` only if the starting cell is free.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Unique Paths II](https://leetcode.com/problems/unique-paths-ii/)


You are given an `m x n` integer array `grid`. There is a robot initially located at the **top-left corner** (i.e., `grid[0][0]`). The robot tries to move to the **bottom-right corner** (i.e., `grid[m - 1][n - 1]`). The robot can only move either down or right at any point in time.

An obstacle and space are marked as `1` or `0` respectively in `grid`. A path that the robot takes cannot include **any** square that is an obstacle.

Return *the number of possible unique paths that the robot can take to reach the bottom-right corner*.

The testcases are generated so that the answer will be less than or equal to `2 * 10<sup>9</sup>`.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2020/11/04/robot1.jpg" style="width: 242px; height: 242px;" />

```text

**Input:** obstacleGrid = [[0,0,0],[0,1,0],[0,0,0]]
**Output:** 2
**Explanation:** There is one obstacle in the middle of the 3x3 grid above.
There are two ways to reach the bottom-right corner:
1. Right -> Right -> Down -> Down
2. Down -> Down -> Right -> Right

```

<strong class="example">Example 2:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2020/11/04/robot2.jpg" style="width: 162px; height: 162px;" />

```text

**Input:** obstacleGrid = [[0,1],[0,0]]
**Output:** 1

```

 

**Constraints:**

	- `m == obstacleGrid.length`

	- `n == obstacleGrid[i].length`

	- `1 <= m, n <= 100`

	- `obstacleGrid[i][j]` is `0` or `1`.

</details>

```java
public int uniquePathsWithObstacles(int[][] grid) {
    int n = grid[0].length;
    // 1D DP array for space optimization; dp[c] stores ways to reach column c
    int[] dp = new int[n];
    
    // The starting cell has 1 path if it's not an obstacle, otherwise 0
    dp[0] = grid[0][0] == 1 ? 0 : 1;
    
    // Iterate through each row of the grid
    for (int[] row : grid) {
        // Iterate through each column
        for (int c = 0; c < n; c++) {
            if (row[c] == 1) {
                // If there's an obstacle, we can't be at this cell (0 ways)
                dp[c] = 0;       
            } else if (c > 0) {
                // If it's a valid cell, add the ways from the left cell
                // The ways from the cell above are already in dp[c]
                dp[c] += dp[c - 1];
            }
        }
    }
    
    // The last element stores the ways to reach the bottom-right corner
    return dp[n - 1];
}
```

### Minimum Path Sum
**Category:** Tier 3 · Reference
**Pattern:** Grid DP (min)  **Time:** O(m·n)  **Space:** O(n)
**Approach:** State `dp[c]` = min cost to reach cell `(r, c)` moving only right/down. Each cell adds its own value to the cheaper of the cell above (`dp[c]` pre-update) and the cell to the left (`dp[c-1]`): `dp[c] = grid[r][c] + min(dp[c], dp[c-1])`. Handle the first row (no above) and first column (no left) as edge cases.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Minimum Path Sum](https://leetcode.com/problems/minimum-path-sum/)


Given a `m x n` `grid` filled with non-negative numbers, find a path from top left to bottom right, which minimizes the sum of all numbers along its path.

**Note:** You can only move either down or right at any point in time.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2020/11/05/minpath.jpg" style="width: 242px; height: 242px;" />

```text

**Input:** grid = [[1,3,1],[1,5,1],[4,2,1]]
**Output:** 7
**Explanation:** Because the path 1 &rarr; 3 &rarr; 1 &rarr; 1 &rarr; 1 minimizes the sum.

```

<strong class="example">Example 2:</strong>

```text

**Input:** grid = [[1,2,3],[4,5,6]]
**Output:** 12

```

 

**Constraints:**

	- `m == grid.length`

	- `n == grid[i].length`

	- `1 <= m, n <= 200`

	- `0 <= grid[i][j] <= 200`

</details>

```java
public int minPathSum(int[][] grid) {
    int m = grid.length, n = grid[0].length;
    // dp array to store the minimum cost to reach each cell in the current row
    int[] dp = new int[n];
    
    // Base case: starting cell
    dp[0] = grid[0][0];
    
    // Pre-fill the first row since we can only move right to reach these cells
    for (int c = 1; c < n; c++) {
        dp[c] = dp[c - 1] + grid[0][c];
    }
    
    // Process the rest of the rows
    for (int r = 1; r < m; r++) {
        // For the first column, we can only arrive from above
        dp[0] += grid[r][0];
        
        // For the remaining columns
        for (int c = 1; c < n; c++) {
            // The cost is the cell's own value plus the cheaper of the cell above (dp[c]) or left (dp[c-1])
            dp[c] = grid[r][c] + Math.min(dp[c], dp[c - 1]);
        }
    }
    
    // Return the accumulated min cost for the bottom-right cell
    return dp[n - 1];
}
```

### Maximal Square
**Category:** Tier 3 · Reference
**Pattern:** Grid DP (largest square)  **Time:** O(m·n)  **Space:** O(n)
**Approach:** State `dp[r][c]` = side length of the largest all-`1` square whose bottom-right corner is `(r, c)`. If the cell is `1`, it equals `1 + min` of its top, left, and top-left neighbors (the limiting square). The answer is the max side found, squared for area. Space-optimize to one row plus a `prev` (top-left) scalar.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Maximal Square](https://leetcode.com/problems/maximal-square/)


Given an `m x n` binary `matrix` filled with `0`'s and `1`'s, *find the largest square containing only* `1`'s *and return its area*.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2020/11/26/max1grid.jpg" style="width: 400px; height: 319px;" />

```text

**Input:** matrix = [["1","0","1","0","0"],["1","0","1","1","1"],["1","1","1","1","1"],["1","0","0","1","0"]]
**Output:** 4

```

<strong class="example">Example 2:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2020/11/26/max2grid.jpg" style="width: 165px; height: 165px;" />

```text

**Input:** matrix = [["0","1"],["1","0"]]
**Output:** 1

```

<strong class="example">Example 3:</strong>

```text

**Input:** matrix = [["0"]]
**Output:** 0

```

 

**Constraints:**

	- `m == matrix.length`

	- `n == matrix[i].length`

	- `1 <= m, n <= 300`

	- `matrix[i][j]` is `'0'` or `'1'`.

</details>

```java
public int maximalSquare(char[][] matrix) {
    int n = matrix[0].length;
    int best = 0; // Tracks the maximum side length seen so far
    
    // dp array will store the side length of the max square ending at column c in the current row
    int[] dp = new int[n + 1];
    
    for (char[] row : matrix) {
        // prev will hold the dp value from the top-left cell (dp[r-1][c-1])
        int prev = 0;                          
        for (int c = 1; c <= n; c++) {
            // Store the current value before we overwrite it, so it can be 'prev' for the next column
            int temp = dp[c];                  
            
            // If the current matrix cell is '1', it can potentially form a square
            if (row[c - 1] == '1') {
                // The side length is 1 plus the minimum of the squares above, left, and top-left
                dp[c] = 1 + Math.min(prev, Math.min(dp[c], dp[c - 1]));
                // Update our global max side length
                best = Math.max(best, dp[c]);
            } else {
                // If it's '0', the square side length ending here must be 0
                dp[c] = 0;
            }
            // Move 'prev' forward for the next cell's top-left reference
            prev = temp;
        }
    }
    // The final answer is the area, so we square the maximum side length
    return best * best;
}
```

### Dungeon Game
**Category:** Tier 3 · Reference
**Pattern:** Grid DP (reverse direction)  **Time:** O(m·n)  **Space:** O(n)
**Approach:** We need the minimum starting health so HP stays `>= 1` everywhere. Because the requirement at a cell depends on the *future*, we fill the table from bottom-right to top-left. State `dp[r][c]` = min HP needed entering `(r, c)`. Need = `min(dp[right], dp[down]) - dungeon[r][c]`, clamped to at least 1 (you can't enter dead). The bottom-right cell needs `max(1, 1 - value)`.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Dungeon Game](https://leetcode.com/problems/dungeon-game/)


The demons had captured the princess and imprisoned her in **the bottom-right corner** of a `dungeon`. The `dungeon` consists of `m x n` rooms laid out in a 2D grid. Our valiant knight was initially positioned in **the top-left room** and must fight his way through `dungeon` to rescue the princess.

The knight has an initial health point represented by a positive integer. If at any point his health point drops to `0` or below, he dies immediately.

Some of the rooms are guarded by demons (represented by negative integers), so the knight loses health upon entering these rooms; other rooms are either empty (represented as 0) or contain magic orbs that increase the knight's health (represented by positive integers).

To reach the princess as quickly as possible, the knight decides to move only **rightward** or **downward** in each step.

Return *the knight's minimum initial health so that he can rescue the princess*.

**Note** that any room can contain threats or power-ups, even the first room the knight enters and the bottom-right room where the princess is imprisoned.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2021/03/13/dungeon-grid-1.jpg" style="width: 253px; height: 253px;" />

```text

**Input:** dungeon = [[-2,-3,3],[-5,-10,1],[10,30,-5]]
**Output:** 7
**Explanation:** The initial health of the knight must be at least 7 if he follows the optimal path: RIGHT-> RIGHT -> DOWN -> DOWN.

```

<strong class="example">Example 2:</strong>

```text

**Input:** dungeon = [[0]]
**Output:** 1

```

 

**Constraints:**

	- `m == dungeon.length`

	- `n == dungeon[i].length`

	- `1 <= m, n <= 200`

	- `-1000 <= dungeon[i][j] <= 1000`

</details>

```java
public int calculateMinimumHP(int[][] dungeon) {
    int m = dungeon.length, n = dungeon[0].length;
    // dp array holds the minimum health required to survive from this column to the princess
    int[] dp = new int[n + 1];
    
    // Fill with infinity because initially everything is unreachable
    Arrays.fill(dp, Integer.MAX_VALUE);
    // Sentinel value right past the exit: you need at least 1 HP to stay alive
    dp[n - 1] = 1;                               
    
    // We iterate backwards from the bottom-right corner to the top-left
    for (int r = m - 1; r >= 0; r--) {
        for (int c = n - 1; c >= 0; c--) {
            // Find the easiest path out of this room (min of going right or down)
            // Then subtract the dungeon's effect. If negative (demon), it increases HP needed.
            // If positive (potion), it decreases HP needed.
            int need = Math.min(dp[c], dp[c + 1]) - dungeon[r][c];
            
            // HP can never drop below 1. If a potion over-healed us to <= 0 requirement, cap it at 1.
            dp[c] = Math.max(1, need);
        }
    }
    // Minimum initial health needed at the start cell
    return dp[0];
}
```

---

## Stock DP

State machine DP over days × (holding / not holding) × extra dimensions like remaining transactions or cooldown.

### Best Time to Buy and Sell with Cooldown
**Category:** Tier 3 · Reference
**Pattern:** State-machine DP  **Time:** O(n)  **Space:** O(1)
**Approach:** Track three rolling states per day: `hold` (currently own a stock), `sold` (just sold today, must cooldown tomorrow), and `rest` (idle, free to buy). Transitions: `hold = max(hold, rest - price)` (keep or buy from rest), `sold = hold + price` (sell), `rest = max(rest, sold)` (stay idle or come off cooldown). The answer is `max(sold, rest)` on the last day.


<!-- Problem Statement not automatically found -->

```java
public int maxProfit(int[] prices) {
    // Initial states:
    // hold: we own a stock. Starts very negative because we haven't bought yet.
    // sold: we just sold today. Starts at 0.
    // rest: we are resting and can buy. Starts at 0.
    int hold = Integer.MIN_VALUE, sold = 0, rest = 0;
    
    // Process each day's price
    for (int p : prices) {
        // Save the previous 'sold' state because 'rest' will need it
        int prevSold = sold;
        
        // If we sell today, we must have been 'hold'ing yesterday. We gain price 'p'.
        sold = hold + p;
        
        // We either keep holding from yesterday, or we buy today from the 'rest' state.
        hold = Math.max(hold, rest - p);
        
        // We can reach 'rest' by either resting again, or coming off cooldown from a previous 'sold'.
        rest = Math.max(rest, prevSold);
    }
    
    // Max profit will always be either after just selling, or resting (not holding a stock)
    return Math.max(sold, rest);
}
```

### Best Time to Buy and Sell Stock IV (k transactions)
**Category:** Tier 3 · Reference
**Pattern:** State-machine DP with transaction count  **Time:** O(n·k)  **Space:** O(k)
**Approach:** For each allowed transaction `t` keep two values: `buy[t]` = best balance having opened up to `t` buys, `sell[t]` = best balance having completed up to `t` sells. Per price: `buy[t] = max(buy[t], sell[t-1] - price)` and `sell[t] = max(sell[t], buy[t] + price)`. When `k >= n/2` it reduces to the unlimited-transaction greedy (sum every upward step).


<!-- Problem Statement not automatically found -->

```java
public int maxProfit(int k, int[] prices) {
    int n = prices.length;
    if (n == 0 || k == 0) return 0; // Quick exit for empty input or 0 transactions
    
    // If k is large enough, we can effectively make unlimited transactions
    // This optimization prevents Memory Limit Exceeded for large k
    if (k >= n / 2) {                            
        int profit = 0;
        // Greedy approach: accumulate all upward price movements
        for (int i = 1; i < n; i++)
            if (prices[i] > prices[i - 1]) profit += prices[i] - prices[i - 1];
        return profit;
    }
    
    // buy[t] = max profit doing exactly t transactions and currently HOLDING a stock
    // sell[t] = max profit doing exactly t transactions and NOT holding a stock
    int[] buy = new int[k + 1], sell = new int[k + 1];
    Arrays.fill(buy, Integer.MIN_VALUE); // Initially holding is impossible
    
    // Iterate through prices
    for (int p : prices) {
        // Update states for each transaction count up to k
        for (int t = 1; t <= k; t++) {
            // buy[t] is the max of: keeping previous buy state, or buying today 
            // after having completed (t-1) full sell transactions
            buy[t] = Math.max(buy[t], sell[t - 1] - p);
            
            // sell[t] is the max of: keeping previous sell state, or selling today 
            // the stock we bought in the t-th transaction
            sell[t] = Math.max(sell[t], buy[t] + p);
        }
    }
    // Max profit after at most k transactions ending without stock
    return sell[k];
}
```

### Best Time to Buy and Sell with Transaction Fee
**Category:** Tier 3 · Reference
**Pattern:** State-machine DP  **Time:** O(n)  **Space:** O(1)
**Approach:** Two rolling states: `cash` (not holding) and `hold` (holding). The fee is charged once per completed transaction, conveniently applied at sell time. Per day: `cash = max(cash, hold + price - fee)` (sell, pay fee) and `hold = max(hold, cash - price)` (buy). Start `hold = -prices[0]`. The final `cash` is the answer.


<!-- Problem Statement not automatically found -->

```java
public int maxProfit(int[] prices, int fee) {
    // cash is max profit when NOT holding a stock
    // hold is max profit when HOLDING a stock (initialized with buying on day 0)
    int cash = 0, hold = -prices[0];
    
    // Iterate from the second day
    for (int i = 1; i < prices.length; i++) {
        // We update cash to be the max of doing nothing (keeping cash),
        // or selling our held stock at today's price minus the transaction fee
        cash = Math.max(cash, hold + prices[i] - fee);
        
        // We update hold to be the max of doing nothing (keeping hold),
        // or buying a new stock today, subtracting the price from our cash
        hold = Math.max(hold, cash - prices[i]);
    }
    
    // The max profit will always be when we are NOT holding a stock at the end
    return cash;
}
```

---

## Bitmask DP

The state encodes a *subset* as the bits of an integer. Useful when `n` is small (≤ ~20).

### Partition to K Equal Sum Subsets
**Category:** Tier 3 · Reference
**Pattern:** Bitmask DP / subset enumeration  **Time:** O(n·2ⁿ)  **Space:** O(2ⁿ)
**Approach:** Total must divide evenly; let `target = total/k`. State `dp[mask]` = the running sum *within the current bucket* using exactly the elements in `mask` (modulo `target`), or -1 if `mask` is unreachable. For each reachable `mask`, try adding each unused element `i` if it keeps the current bucket `<= target`. Filling all elements (`mask` all ones) with each completed bucket resetting to 0 means a valid partition exists.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Partition to K Equal Sum Subsets](https://leetcode.com/problems/partition-to-k-equal-sum-subsets/)


Given an integer array `nums` and an integer `k`, return `true` if it is possible to divide this array into `k` non-empty subsets whose sums are all equal.

 

<strong class="example">Example 1:</strong>

```text

**Input:** nums = [4,3,2,3,5,2,1], k = 4
**Output:** true
**Explanation:** It is possible to divide it into 4 subsets (5), (1, 4), (2,3), (2,3) with equal sums.

```

<strong class="example">Example 2:</strong>

```text

**Input:** nums = [1,2,3,4], k = 3
**Output:** false

```

 

**Constraints:**

	- `1 <= k <= nums.length <= 16`

	- `1 <= nums[i] <= 10<sup>4</sup>`

	- The frequency of each element is in the range `[1, 4]`.

</details>

```java
public boolean canPartitionKSubsets(int[] nums, int k) {
    int total = 0;
    // Calculate total sum
    for (int x : nums) total += x;
    
    // Total sum must be perfectly divisible by k
    if (total % k != 0) return false;
    
    int target = total / k, n = nums.length;
    // dp array where index is the bitmask of used elements
    // The value will be the sum of elements in the *currently forming* bucket, or -1 if unreachable
    int[] dp = new int[1 << n];
    Arrays.fill(dp, -1);
    dp[0] = 0; // Empty mask means bucket sum is 0
    
    // Iterate through every possible subset configuration
    for (int mask = 0; mask < (1 << n); mask++) {
        // Skip unreachable masks
        if (dp[mask] == -1) continue;
        
        // Try to append each unused element to the current subset
        for (int i = 0; i < n; i++) {
            // Check if the i-th element is already used in this mask
            if ((mask & (1 << i)) != 0) continue;        
            
            // If adding this element doesn't exceed the target bucket size
            if (dp[mask] + nums[i] <= target) {
                // Form the next mask with the i-th bit set
                int next = mask | (1 << i);
                
                // If this state hasn't been reached yet
                if (dp[next] == -1)
                    // Update the running sum. If it hits target, modulo resets it to 0 for the next bucket
                    dp[next] = (dp[mask] + nums[i]) % target;   
            }
        }
    }
    // If the state representing all elements used (all 1s) ends with a clean 0 bucket sum, it's possible
    return dp[(1 << n) - 1] == 0;
}
```

### Travelling Salesman Problem (brief)
**Category:** Tier 3 · Reference
**Pattern:** Bitmask DP (Held–Karp)  **Time:** O(n²·2ⁿ)  **Space:** O(n·2ⁿ)
**Approach:** State `dp[mask][i]` = min cost of a path that has visited exactly the cities in `mask` and currently sits at city `i`. Transition: extend to an unvisited city `j` via `dp[mask | (1<<j)][j] = min(..., dp[mask][i] + dist[i][j])`. Start at city 0 (`dp[1][0] = 0`). The answer closes the tour: `min over i of dp[full][i] + dist[i][0]`.


<!-- Problem Statement not automatically found -->

```java
public int tsp(int[][] dist) {
    int n = dist.length;
    int FULL = (1 << n) - 1; // Bitmask with all n bits set to 1
    
    // dp[mask][i] is the min cost to visit the set of cities in 'mask' ending at city 'i'
    int[][] dp = new int[1 << n][n];
    
    // Initialize all distances to 'infinity'
    for (int[] row : dp) Arrays.fill(row, Integer.MAX_VALUE / 2);
    
    // Start at city 0: mask 1 (binary ...0001) with current city 0
    dp[1][0] = 0;                                 
    
    // Loop through all possible subsets of visited cities
    for (int mask = 1; mask <= FULL; mask++) {
        for (int i = 0; i < n; i++) {
            // Check if city 'i' is in the current 'mask' and is reachable
            if ((mask & (1 << i)) == 0 || dp[mask][i] >= Integer.MAX_VALUE / 2) continue;
            
            // Try to move to any unvisited city 'j'
            for (int j = 0; j < n; j++) {
                // If 'j' is already visited in 'mask', skip
                if ((mask & (1 << j)) != 0) continue;
                
                // Form new mask that includes city 'j'
                int next = mask | (1 << j);
                
                // Relaxation step: update the path cost to 'next' mask ending at 'j'
                dp[next][j] = Math.min(dp[next][j], dp[mask][i] + dist[i][j]);
            }
        }
    }
    
    int best = Integer.MAX_VALUE;
    // The tour is complete when all cities are visited (FULL mask)
    // We must return to the start city 0 from the last visited city 'i'
    for (int i = 0; i < n; i++) {
        best = Math.min(best, dp[FULL][i] + dist[i][0]);
    }
    return best;
}
```

---

## DP on Trees

State is computed per node from its children via post-order traversal; each node returns one or more values that the parent combines.

### House Robber III
**Category:** Tier 3 · Reference
**Pattern:** Tree DP (pick/skip per node)  **Time:** O(n)  **Space:** O(h)
**Approach:** For each node return a pair `{rob, skip}`: `rob` = max money if we rob this node (so we must skip both children) = `node.val + left.skip + right.skip`; `skip` = max money if we don't rob this node (children may be robbed or not) = `max(left.rob, left.skip) + max(right.rob, right.skip)`. The answer at the root is `max(rob, skip)`.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [House Robber III](https://leetcode.com/problems/house-robber-iii/)


The thief has found himself a new place for his thievery again. There is only one entrance to this area, called `root`.

Besides the `root`, each house has one and only one parent house. After a tour, the smart thief realized that all houses in this place form a binary tree. It will automatically contact the police if **two directly-linked houses were broken into on the same night**.

Given the `root` of the binary tree, return *the maximum amount of money the thief can rob **without alerting the police***.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2021/03/10/rob1-tree.jpg" style="width: 277px; height: 293px;" />

```text

**Input:** root = [3,2,3,null,3,null,1]
**Output:** 7
**Explanation:** Maximum amount of money the thief can rob = 3 + 3 + 1 = 7.

```

<strong class="example">Example 2:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2021/03/10/rob2-tree.jpg" style="width: 357px; height: 293px;" />

```text

**Input:** root = [3,4,5,1,3,null,1]
**Output:** 9
**Explanation:** Maximum amount of money the thief can rob = 4 + 5 = 9.

```

 

**Constraints:**

	- The number of nodes in the tree is in the range `[1, 10<sup>4</sup>]`.

	- `0 <= Node.val <= 10<sup>4</sup>`

</details>

```java
public int rob(TreeNode root) {
    // DFS returns an array where index 0 is 'rob this node' and index 1 is 'skip this node'
    int[] r = dfs(root);
    // Return the max of robbing the root vs skipping the root
    return Math.max(r[0], r[1]);
}

// Post-order traversal helper. Returns {robThis, skipThis}
private int[] dfs(TreeNode node) {
    // Base case: null nodes yield 0 money in both scenarios
    if (node == null) return new int[]{0, 0};
    
    // Recursively solve for left and right children
    int[] L = dfs(node.left), R = dfs(node.right);
    
    // If we rob this node, we CANNOT rob its children. We must use their 'skip' values
    int rob = node.val + L[1] + R[1];
    
    // If we skip this node, its children can independently be robbed or skipped.
    // We take the best possible combination for each child.
    int skip = Math.max(L[0], L[1]) + Math.max(R[0], R[1]);
    
    return new int[]{rob, skip};
}
```

### Binary Tree Cameras
**Category:** Tier 3 · Reference
**Pattern:** Tree DP (greedy state per node)  **Time:** O(n)  **Space:** O(h)
**Approach:** Each node reports one of three states upward: `0` = not covered (needs a parent camera), `1` = covered but has no camera, `2` = has a camera. Post-order: if either child is uncovered (`0`), this node must place a camera (`2`, increment count). If either child has a camera (`2`), this node is covered without one (`1`). Otherwise this node is uncovered (`0`) and relies on its parent. Null children are treated as covered (`1`) so leaves report uncovered. Finally, if the root reports uncovered, add one camera.


<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Binary Tree Cameras](https://leetcode.com/problems/binary-tree-cameras/)


You are given the `root` of a binary tree. We install cameras on the tree nodes where each camera at a node can monitor its parent, itself, and its immediate children.

Return *the minimum number of cameras needed to monitor all nodes of the tree*.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2018/12/29/bst_cameras_01.png" style="width: 138px; height: 163px;" />

```text

**Input:** root = [0,0,null,0,0]
**Output:** 1
**Explanation:** One camera is enough to monitor all nodes if placed as shown.

```

<strong class="example">Example 2:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2018/12/29/bst_cameras_02.png" style="width: 139px; height: 312px;" />

```text

**Input:** root = [0,0,null,0,null,0,null,null,0]
**Output:** 2
**Explanation:** At least two cameras are needed to monitor all nodes of the tree. The above image shows one of the valid configurations of camera placement.

```

 

**Constraints:**

	- The number of nodes in the tree is in the range `[1, 1000]`.

	- `Node.val == 0`

</details>

```java
private int cameras = 0; // Global tracker for total cameras deployed

public int minCameraCover(TreeNode root) {
    // If the root is completely uncovered (state 0), we must add a camera at the root
    if (dfs(root) == 0) cameras++;               
    return cameras;
}

// Possible states: 
// 0 = uncovered (needs parent to place a camera)
// 1 = covered (child or parent has camera, this node does not)
// 2 = has camera (we placed a camera here)
private int dfs(TreeNode node) {
    // Null nodes don't need coverage, we treat them as "covered" to avoid forcing cameras on leaves
    if (node == null) return 1;                  
    
    // Post-order traversal to process children first
    int l = dfs(node.left), r = dfs(node.right);
    
    // If either child is uncovered, this node MUST place a camera to cover it
    if (l == 0 || r == 0) { 
        cameras++; 
        return 2; // Tell parent we have a camera
    }   
    
    // If either child has a camera, this node is covered by it
    if (l == 2 || r == 2) return 1;                  
    
    // If both children are covered (state 1) but neither has a camera,
    // this node is currently uncovered. Tell parent to cover us.
    return 0;                                        
}
```

---

## Quick reference: choosing the loop order

| Problem type | Loop order quirk |
|---|---|
| 0/1 knapsack (1-D) | capacity **backward** so each item used once |
| Unbounded knapsack (1-D) | capacity **forward** so items reused |
| Coin Change II (combinations) | coin loop **outer** |
| Combination Sum IV (permutations) | target loop **outer** |
| Interval DP | iterate by **increasing interval length** |
| Dungeon Game | fill **bottom-right → top-left** |
| Palindromic subsequence | `i` **decreasing**, `j` increasing |

> **Debugging tip:** when a bottom-up answer is wrong, re-derive it top-down with memoization first. The recursion makes the recurrence and base cases explicit, and you can confirm the table iteration order matches the dependency direction.
