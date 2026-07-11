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

```java
public int climbStairs(int n) {
    if (n <= 2) return n;
    int prev2 = 1, prev1 = 2; // ways to reach step 1 and step 2
    for (int i = 3; i <= n; i++) {
        int cur = prev1 + prev2;
        prev2 = prev1;
        prev1 = cur;
    }
    return prev1;
}
```

**Alternative (top-down memo):**
```java
public int climbStairs(int n) {
    return go(n, new int[n + 1]);
}
private int go(int n, int[] memo) {
    if (n <= 2) return n == 0 ? 1 : n;
    if (memo[n] != 0) return memo[n];
    return memo[n] = go(n - 1, memo) + go(n - 2, memo);
}
```

### House Robber
**Category:** ⭐ Tier 1 · Core
**Pattern:** 1-D pick/skip  **Time:** O(n)  **Space:** O(1)
**Approach:** State `dp[i]` = max money robbable considering houses `0..i`. At house `i` you either rob it (then you cannot rob `i-1`, giving `nums[i] + dp[i-2]`) or skip it (`dp[i-1]`). So `dp[i] = max(dp[i-1], nums[i] + dp[i-2])`. Only the last two values matter, so use two rolling variables.

```java
public int rob(int[] nums) {
    int prev2 = 0, prev1 = 0; // best up to i-2 and i-1
    for (int num : nums) {
        int cur = Math.max(prev1, prev2 + num);
        prev2 = prev1;
        prev1 = cur;
    }
    return prev1;
}
```

### House Robber II
**Category:** Tier 2 · Reinforce
**Pattern:** 1-D pick/skip on a circle  **Time:** O(n)  **Space:** O(1)
**Approach:** Houses are arranged in a circle, so the first and last houses are adjacent and cannot both be robbed. Split into two independent linear House Robber problems: one over `[0, n-2]` (exclude the last house) and one over `[1, n-1]` (exclude the first), then take the max. Handle the single-house edge case separately.

```java
public int rob(int[] nums) {
    int n = nums.length;
    if (n == 1) return nums[0];
    return Math.max(robLine(nums, 0, n - 2), robLine(nums, 1, n - 1));
}
private int robLine(int[] nums, int lo, int hi) {
    int prev2 = 0, prev1 = 0;
    for (int i = lo; i <= hi; i++) {
        int cur = Math.max(prev1, prev2 + nums[i]);
        prev2 = prev1;
        prev1 = cur;
    }
    return prev1;
}
```

### Decode Ways
**Category:** Tier 3 · Reference
**Pattern:** 1-D Fibonacci with validity checks  **Time:** O(n)  **Space:** O(1)
**Approach:** State `dp[i]` = number of ways to decode the prefix of length `i`. A single digit `s[i-1]` decodes if it is `1..9`, contributing `dp[i-1]`. A two-digit number `s[i-2..i-1]` decodes if it is `10..26`, contributing `dp[i-2]`. So `dp[i] = (single valid ? dp[i-1] : 0) + (double valid ? dp[i-2] : 0)`. Base case `dp[0] = 1` (empty string has one decoding).

```java
public int numDecodings(String s) {
    if (s.charAt(0) == '0') return 0;
    int prev2 = 1, prev1 = 1; // dp[0], dp[1]
    for (int i = 2; i <= s.length(); i++) {
        int cur = 0;
        if (s.charAt(i - 1) != '0') cur += prev1;        // single digit
        int two = (s.charAt(i - 2) - '0') * 10 + (s.charAt(i - 1) - '0');
        if (two >= 10 && two <= 26) cur += prev2;         // two digits
        prev2 = prev1;
        prev1 = cur;
    }
    return prev1;
}
```

### Min Cost Climbing Stairs
**Category:** Tier 3 · Reference
**Pattern:** 1-D Fibonacci (min)  **Time:** O(n)  **Space:** O(1)
**Approach:** State `dp[i]` = minimum cost to reach step `i` (the top is index `n`). To stand on step `i` you arrive from `i-1` or `i-2`, each costing that step's `cost` to step off: `dp[i] = min(dp[i-1] + cost[i-1], dp[i-2] + cost[i-2])`. You may start at step 0 or 1 for free, so `dp[0] = dp[1] = 0`.

```java
public int minCostClimbingStairs(int[] cost) {
    int prev2 = 0, prev1 = 0;
    for (int i = 2; i <= cost.length; i++) {
        int cur = Math.min(prev1 + cost[i - 1], prev2 + cost[i - 2]);
        prev2 = prev1;
        prev1 = cur;
    }
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

```java
public int knapsack(int[] wt, int[] val, int W) {
    int[] dp = new int[W + 1];
    for (int i = 0; i < wt.length; i++) {
        for (int w = W; w >= wt[i]; w--) {        // backward => each item once
            dp[w] = Math.max(dp[w], val[i] + dp[w - wt[i]]);
        }
    }
    return dp[W];
}
```

**Alternative (full 2-D table, easier to reason about):**
```java
public int knapsack2D(int[] wt, int[] val, int W) {
    int n = wt.length;
    int[][] dp = new int[n + 1][W + 1];
    for (int i = 1; i <= n; i++) {
        for (int w = 0; w <= W; w++) {
            dp[i][w] = dp[i - 1][w];                          // skip item i
            if (w >= wt[i - 1])
                dp[i][w] = Math.max(dp[i][w], val[i - 1] + dp[i - 1][w - wt[i - 1]]);
        }
    }
    return dp[n][W];
}
```

### Partition Equal Subset Sum
**Category:** ⭐ Tier 1 · Core
**Pattern:** 0/1 Knapsack (subset-sum feasibility)  **Time:** O(n·sum)  **Space:** O(sum)
**Approach:** We can split into two equal halves iff a subset sums to `total/2`. State `dp[s]` = is sum `s` achievable with some subset. Transition is the boolean knapsack: `dp[s] |= dp[s - num]`. If `total` is odd, immediately return false. Iterate the target sum backwards so each number is used once.

```java
public boolean canPartition(int[] nums) {
    int total = 0;
    for (int n : nums) total += n;
    if (total % 2 != 0) return false;
    int target = total / 2;
    boolean[] dp = new boolean[target + 1];
    dp[0] = true;
    for (int num : nums) {
        for (int s = target; s >= num; s--) {
            dp[s] = dp[s] || dp[s - num];
        }
    }
    return dp[target];
}
```

### Target Sum
**Category:** Tier 3 · Reference
**Pattern:** 0/1 Knapsack (count subsets)  **Time:** O(n·sum)  **Space:** O(sum)
**Approach:** Assigning `+`/`-` to each number and reaching `target` is equivalent to choosing a positive subset `P` with `sum(P) = (total + target) / 2` (the rest are negative). So count subsets summing to that value. State `dp[s]` = number of subsets summing to `s`; transition `dp[s] += dp[s - num]`. The required sum must be a non-negative even split, else the answer is 0.

```java
public int findTargetSumWays(int[] nums, int target) {
    int total = 0;
    for (int n : nums) total += n;
    if (Math.abs(target) > total || (total + target) % 2 != 0) return 0;
    int subset = (total + target) / 2;
    int[] dp = new int[subset + 1];
    dp[0] = 1;
    for (int num : nums) {
        for (int s = subset; s >= num; s--) {
            dp[s] += dp[s - num];
        }
    }
    return dp[subset];
}
```

### Last Stone Weight II
**Category:** Tier 3 · Reference
**Pattern:** 0/1 Knapsack (minimize difference)  **Time:** O(n·sum)  **Space:** O(sum)
**Approach:** Smashing stones partitions them into two groups with sums `S1` and `S2`; the final stone equals `|S1 - S2|`. To minimize this, pick a subset whose sum is as close as possible to `total/2`. State `dp[s]` = is sum `s` reachable; find the largest reachable `s <= total/2`, then the answer is `total - 2*s`.

```java
public int lastStoneWeightII(int[] stones) {
    int total = 0;
    for (int s : stones) total += s;
    int half = total / 2;
    boolean[] dp = new boolean[half + 1];
    dp[0] = true;
    for (int stone : stones) {
        for (int s = half; s >= stone; s--) {
            dp[s] = dp[s] || dp[s - stone];
        }
    }
    for (int s = half; s >= 0; s--) {
        if (dp[s]) return total - 2 * s;
    }
    return total;
}
```

---

## Unbounded Knapsack

Each item may be taken **any number of times**. The space-optimized loop iterates capacity **forwards** so the current item can be reused within the same pass.

### Coin Change (minimum coins)
**Category:** ⭐ Tier 1 · Core
**Pattern:** Unbounded Knapsack (min)  **Time:** O(n·amount)  **Space:** O(amount)
**Approach:** State `dp[a]` = minimum number of coins to make amount `a`. For each amount, try every coin: `dp[a] = min(dp[a], dp[a - coin] + 1)`. Initialize to a sentinel "infinity" (`amount + 1`) and `dp[0] = 0`. Forward iteration over `a` lets a coin be reused. If `dp[amount]` is still the sentinel, the amount is unreachable.

```java
public int coinChange(int[] coins, int amount) {
    int[] dp = new int[amount + 1];
    Arrays.fill(dp, amount + 1);
    dp[0] = 0;
    for (int coin : coins) {
        for (int a = coin; a <= amount; a++) {
            dp[a] = Math.min(dp[a], dp[a - coin] + 1);
        }
    }
    return dp[amount] > amount ? -1 : dp[amount];
}
```

### Coin Change II (count combinations)
**Category:** Tier 2 · Reinforce
**Pattern:** Unbounded Knapsack (count combinations)  **Time:** O(n·amount)  **Space:** O(amount)
**Approach:** State `dp[a]` = number of **combinations** summing to `a`. Transition `dp[a] += dp[a - coin]`. The coin loop must be the **outer** loop so combinations are counted regardless of order (each coin type is fully processed before moving on), which avoids counting `1+2` and `2+1` as distinct. Base case `dp[0] = 1` (the empty combination).

```java
public int change(int amount, int[] coins) {
    int[] dp = new int[amount + 1];
    dp[0] = 1;
    for (int coin : coins) {            // coins outer => combinations, not permutations
        for (int a = coin; a <= amount; a++) {
            dp[a] += dp[a - coin];
        }
    }
    return dp[amount];
}
```

### Combination Sum IV
**Category:** Tier 3 · Reference
**Pattern:** Unbounded Knapsack (count permutations)  **Time:** O(n·target)  **Space:** O(target)
**Approach:** Here different orderings count as distinct, so we count **permutations**. State `dp[t]` = number of ordered sequences summing to `t`, with `dp[t] += dp[t - num]`. The target loop is **outer** and the numbers loop is inner — the mirror image of Coin Change II — because at each total we consider every possible last element. Use `long` accumulation to avoid overflow if intermediate counts are large.

```java
public int combinationSum4(int[] nums, int target) {
    int[] dp = new int[target + 1];
    dp[0] = 1;
    for (int t = 1; t <= target; t++) {     // target outer => permutations
        for (int num : nums) {
            if (t >= num) dp[t] += dp[t - num];
        }
    }
    return dp[target];
}
```

### Rod Cutting
**Category:** Tier 3 · Reference
**Pattern:** Unbounded Knapsack (max value)  **Time:** O(n²)  **Space:** O(n)
**Approach:** Given prices for each length `1..n`, state `dp[len]` = max revenue obtainable from a rod of length `len`. Make the first cut of size `i` (revenue `price[i-1]`) and recurse on the remainder: `dp[len] = max over i of price[i-1] + dp[len - i]`. Pieces are reusable, so this is unbounded knapsack with weight = length and value = price.

```java
public int rodCutting(int[] price, int n) {
    // price[i] = value of a piece of length i+1
    int[] dp = new int[n + 1];
    for (int len = 1; len <= n; len++) {
        for (int i = 1; i <= len; i++) {
            dp[len] = Math.max(dp[len], price[i - 1] + dp[len - i]);
        }
    }
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

```java
public int lengthOfLIS(int[] nums) {
    int n = nums.length, best = 1;
    int[] dp = new int[n];
    Arrays.fill(dp, 1);
    for (int i = 1; i < n; i++) {
        for (int j = 0; j < i; j++) {
            if (nums[j] < nums[i]) dp[i] = Math.max(dp[i], dp[j] + 1);
        }
        best = Math.max(best, dp[i]);
    }
    return best;
}
```

**Alternative (O(n log n) patience sorting):** Maintain `tails`, where `tails[k]` is the smallest possible tail of an increasing subsequence of length `k+1`. For each number, binary-search the first tail `>= num` and replace it (or append if none). The length of `tails` is the LIS length. `tails` is not a real subsequence, but its size is correct.
```java
public int lengthOfLIS(int[] nums) {
    int[] tails = new int[nums.length];
    int size = 0;
    for (int num : nums) {
        int lo = 0, hi = size;
        while (lo < hi) {                 // find first tail >= num
            int mid = (lo + hi) >>> 1;
            if (tails[mid] < num) lo = mid + 1;
            else hi = mid;
        }
        tails[lo] = num;
        if (lo == size) size++;
    }
    return size;
}
```

### Longest Common Subsequence
**Category:** ⭐ Tier 1 · Core
**Pattern:** Two-sequence DP  **Time:** O(m·n)  **Space:** O(min(m,n)) optimizable
**Approach:** State `dp[i][j]` = LCS length of `a[0..i)` and `b[0..j)`. If the last characters match, extend the diagonal: `dp[i][j] = dp[i-1][j-1] + 1`. Otherwise drop one character: `dp[i][j] = max(dp[i-1][j], dp[i][j-1])`. Base row/column are zero (empty string).

```java
public int longestCommonSubsequence(String a, String b) {
    int m = a.length(), n = b.length();
    int[][] dp = new int[m + 1][n + 1];
    for (int i = 1; i <= m; i++) {
        for (int j = 1; j <= n; j++) {
            if (a.charAt(i - 1) == b.charAt(j - 1))
                dp[i][j] = dp[i - 1][j - 1] + 1;
            else
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
    }
    return dp[m][n];
}
```

### Edit Distance
**Category:** ⭐ Tier 1 · Core
**Pattern:** Two-sequence DP  **Time:** O(m·n)  **Space:** O(m·n)
**Approach:** State `dp[i][j]` = minimum operations (insert/delete/replace) to turn `a[0..i)` into `b[0..j)`. If the last chars match, no cost: `dp[i][j] = dp[i-1][j-1]`. Otherwise take `1 + min` of replace (`dp[i-1][j-1]`), delete (`dp[i-1][j]`), insert (`dp[i][j-1]`). Base cases: converting to/from an empty string costs that string's length.

```java
public int minDistance(String a, String b) {
    int m = a.length(), n = b.length();
    int[][] dp = new int[m + 1][n + 1];
    for (int i = 0; i <= m; i++) dp[i][0] = i;   // delete all
    for (int j = 0; j <= n; j++) dp[0][j] = j;   // insert all
    for (int i = 1; i <= m; i++) {
        for (int j = 1; j <= n; j++) {
            if (a.charAt(i - 1) == b.charAt(j - 1))
                dp[i][j] = dp[i - 1][j - 1];
            else
                dp[i][j] = 1 + Math.min(dp[i - 1][j - 1],
                              Math.min(dp[i - 1][j], dp[i][j - 1]));
        }
    }
    return dp[m][n];
}
```

### Distinct Subsequences
**Category:** Tier 3 · Reference
**Pattern:** Two-sequence DP (count)  **Time:** O(m·n)  **Space:** O(n)
**Approach:** State `dp[i][j]` = number of times `t[0..j)` appears as a subsequence of `s[0..i)`. We always have the option to skip `s[i-1]`: `dp[i][j] = dp[i-1][j]`. If `s[i-1] == t[j-1]` we may also match it, adding `dp[i-1][j-1]`. Base: `dp[i][0] = 1` (empty `t` matches once). Space-optimize to 1-D by iterating `j` backwards.

```java
public int numDistinct(String s, String t) {
    int n = t.length();
    long[] dp = new long[n + 1];
    dp[0] = 1;
    for (int i = 1; i <= s.length(); i++) {
        for (int j = n; j >= 1; j--) {        // backward to reuse old dp[j-1]
            if (s.charAt(i - 1) == t.charAt(j - 1)) dp[j] += dp[j - 1];
        }
    }
    return (int) dp[n];
}
```

### Longest Palindromic Subsequence
**Category:** Tier 3 · Reference
**Pattern:** Interval / subsequence DP  **Time:** O(n²)  **Space:** O(n²)
**Approach:** State `dp[i][j]` = length of the longest palindromic subsequence within `s[i..j]`. If the ends match, they wrap an inner palindrome: `dp[i][j] = dp[i+1][j-1] + 2`. Otherwise drop one end: `dp[i][j] = max(dp[i+1][j], dp[i][j-1])`. Single characters are palindromes of length 1. Iterate `i` from high to low (so `i+1` is ready) and `j` from `i+1` up.

```java
public int longestPalindromeSubseq(String s) {
    int n = s.length();
    int[][] dp = new int[n][n];
    for (int i = n - 1; i >= 0; i--) {
        dp[i][i] = 1;
        for (int j = i + 1; j < n; j++) {
            if (s.charAt(i) == s.charAt(j))
                dp[i][j] = dp[i + 1][j - 1] + 2;
            else
                dp[i][j] = Math.max(dp[i + 1][j], dp[i][j - 1]);
        }
    }
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

```java
public int maxCoins(int[] nums) {
    int n = nums.length;
    int[] a = new int[n + 2];
    a[0] = a[n + 1] = 1;
    for (int i = 0; i < n; i++) a[i + 1] = nums[i];
    int[][] dp = new int[n + 2][n + 2];
    for (int len = 2; len <= n + 1; len++) {      // distance between i and j
        for (int i = 0; i + len <= n + 1; i++) {
            int j = i + len;
            for (int k = i + 1; k < j; k++) {      // k = last balloon burst
                dp[i][j] = Math.max(dp[i][j],
                    a[i] * a[k] * a[j] + dp[i][k] + dp[k][j]);
            }
        }
    }
    return dp[0][n + 1];
}
```

### Matrix Chain Multiplication
**Category:** Tier 3 · Reference
**Pattern:** Interval DP (split point)  **Time:** O(n³)  **Space:** O(n²)
**Approach:** Given dimensions `p[0..n]` where matrix `i` is `p[i-1] × p[i]`, state `dp[i][j]` = min scalar multiplications to multiply matrices `i..j`. Try every split `k` where the last multiplication joins the products of `i..k` and `k+1..j`, costing `p[i-1]*p[k]*p[j]`: `dp[i][j] = min over k of dp[i][k] + dp[k+1][j] + p[i-1]*p[k]*p[j]`. Single matrices cost 0.

```java
public int matrixChainOrder(int[] p) {
    int n = p.length - 1;                  // number of matrices
    int[][] dp = new int[n + 1][n + 1];
    for (int len = 2; len <= n; len++) {
        for (int i = 1; i + len - 1 <= n; i++) {
            int j = i + len - 1;
            dp[i][j] = Integer.MAX_VALUE;
            for (int k = i; k < j; k++) {
                int cost = dp[i][k] + dp[k + 1][j] + p[i - 1] * p[k] * p[j];
                dp[i][j] = Math.min(dp[i][j], cost);
            }
        }
    }
    return dp[1][n];
}
```

### Palindrome Partitioning II
**Category:** Tier 3 · Reference
**Pattern:** Interval precompute + 1-D DP  **Time:** O(n²)  **Space:** O(n²)
**Approach:** We want the minimum cuts to split `s` into palindromes. First precompute `pal[i][j]` = whether `s[i..j]` is a palindrome (interval DP: `s[i]==s[j]` and inner is palindrome). Then `cut[i]` = min cuts for prefix `s[0..i)`: if `s[0..i)` is itself a palindrome, `cut[i] = 0`; otherwise `cut[i] = min over j of cut[j] + 1` where `s[j..i)` is a palindrome.

```java
public int minCut(String s) {
    int n = s.length();
    boolean[][] pal = new boolean[n][n];
    for (int i = n - 1; i >= 0; i--) {
        for (int j = i; j < n; j++) {
            if (s.charAt(i) == s.charAt(j) && (j - i < 2 || pal[i + 1][j - 1]))
                pal[i][j] = true;
        }
    }
    int[] cut = new int[n + 1];
    for (int i = 1; i <= n; i++) {
        cut[i] = i - 1;                       // worst case: cut every char
        for (int j = 0; j < i; j++) {
            if (pal[j][i - 1]) cut[i] = Math.min(cut[i], (j == 0 ? 0 : cut[j] + 1));
        }
    }
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

```java
public int uniquePaths(int m, int n) {
    int[] dp = new int[n];
    Arrays.fill(dp, 1);
    for (int r = 1; r < m; r++) {
        for (int c = 1; c < n; c++) {
            dp[c] += dp[c - 1];               // above + left
        }
    }
    return dp[n - 1];
}
```

### Unique Paths II
**Category:** Tier 2 · Reinforce
**Pattern:** Grid DP (count with obstacles)  **Time:** O(m·n)  **Space:** O(n)
**Approach:** Same as Unique Paths but obstacle cells (value 1) have zero paths. State `dp[c]` = ways to reach column `c` in the current row; set it to 0 at obstacles, otherwise `dp[c] += dp[c-1]`. Initialize `dp[0] = 1` only if the starting cell is free.

```java
public int uniquePathsWithObstacles(int[][] grid) {
    int n = grid[0].length;
    int[] dp = new int[n];
    dp[0] = grid[0][0] == 1 ? 0 : 1;
    for (int[] row : grid) {
        for (int c = 0; c < n; c++) {
            if (row[c] == 1) dp[c] = 0;       // obstacle: unreachable
            else if (c > 0) dp[c] += dp[c - 1];
        }
    }
    return dp[n - 1];
}
```

### Minimum Path Sum
**Category:** Tier 3 · Reference
**Pattern:** Grid DP (min)  **Time:** O(m·n)  **Space:** O(n)
**Approach:** State `dp[c]` = min cost to reach cell `(r, c)` moving only right/down. Each cell adds its own value to the cheaper of the cell above (`dp[c]` pre-update) and the cell to the left (`dp[c-1]`): `dp[c] = grid[r][c] + min(dp[c], dp[c-1])`. Handle the first row (no above) and first column (no left) as edge cases.

```java
public int minPathSum(int[][] grid) {
    int m = grid.length, n = grid[0].length;
    int[] dp = new int[n];
    dp[0] = grid[0][0];
    for (int c = 1; c < n; c++) dp[c] = dp[c - 1] + grid[0][c];
    for (int r = 1; r < m; r++) {
        dp[0] += grid[r][0];
        for (int c = 1; c < n; c++) {
            dp[c] = grid[r][c] + Math.min(dp[c], dp[c - 1]);
        }
    }
    return dp[n - 1];
}
```

### Maximal Square
**Category:** Tier 3 · Reference
**Pattern:** Grid DP (largest square)  **Time:** O(m·n)  **Space:** O(n)
**Approach:** State `dp[r][c]` = side length of the largest all-`1` square whose bottom-right corner is `(r, c)`. If the cell is `1`, it equals `1 + min` of its top, left, and top-left neighbors (the limiting square). The answer is the max side found, squared for area. Space-optimize to one row plus a `prev` (top-left) scalar.

```java
public int maximalSquare(char[][] matrix) {
    int n = matrix[0].length, best = 0;
    int[] dp = new int[n + 1];
    for (char[] row : matrix) {
        int prev = 0;                          // dp[r-1][c-1]
        for (int c = 1; c <= n; c++) {
            int temp = dp[c];                  // save dp[r-1][c] before overwrite
            if (row[c - 1] == '1') {
                dp[c] = 1 + Math.min(prev, Math.min(dp[c], dp[c - 1]));
                best = Math.max(best, dp[c]);
            } else {
                dp[c] = 0;
            }
            prev = temp;
        }
    }
    return best * best;
}
```

### Dungeon Game
**Category:** Tier 3 · Reference
**Pattern:** Grid DP (reverse direction)  **Time:** O(m·n)  **Space:** O(n)
**Approach:** We need the minimum starting health so HP stays `>= 1` everywhere. Because the requirement at a cell depends on the *future*, we fill the table from bottom-right to top-left. State `dp[r][c]` = min HP needed entering `(r, c)`. Need = `min(dp[right], dp[down]) - dungeon[r][c]`, clamped to at least 1 (you can't enter dead). The bottom-right cell needs `max(1, 1 - value)`.

```java
public int calculateMinimumHP(int[][] dungeon) {
    int m = dungeon.length, n = dungeon[0].length;
    int[] dp = new int[n + 1];
    Arrays.fill(dp, Integer.MAX_VALUE);
    dp[n - 1] = dp[n] = 1;                       // sentinel just past the exit
    for (int r = m - 1; r >= 0; r--) {
        for (int c = n - 1; c >= 0; c--) {
            int need = Math.min(dp[c], dp[c + 1]) - dungeon[r][c];
            dp[c] = Math.max(1, need);
        }
    }
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

```java
public int maxProfit(int[] prices) {
    int hold = Integer.MIN_VALUE, sold = 0, rest = 0;
    for (int p : prices) {
        int prevSold = sold;
        sold = hold + p;
        hold = Math.max(hold, rest - p);
        rest = Math.max(rest, prevSold);
    }
    return Math.max(sold, rest);
}
```

### Best Time to Buy and Sell Stock IV (k transactions)
**Category:** Tier 3 · Reference
**Pattern:** State-machine DP with transaction count  **Time:** O(n·k)  **Space:** O(k)
**Approach:** For each allowed transaction `t` keep two values: `buy[t]` = best balance having opened up to `t` buys, `sell[t]` = best balance having completed up to `t` sells. Per price: `buy[t] = max(buy[t], sell[t-1] - price)` and `sell[t] = max(sell[t], buy[t] + price)`. When `k >= n/2` it reduces to the unlimited-transaction greedy (sum every upward step).

```java
public int maxProfit(int k, int[] prices) {
    int n = prices.length;
    if (n == 0 || k == 0) return 0;
    if (k >= n / 2) {                            // unlimited transactions
        int profit = 0;
        for (int i = 1; i < n; i++)
            if (prices[i] > prices[i - 1]) profit += prices[i] - prices[i - 1];
        return profit;
    }
    int[] buy = new int[k + 1], sell = new int[k + 1];
    Arrays.fill(buy, Integer.MIN_VALUE);
    for (int p : prices) {
        for (int t = 1; t <= k; t++) {
            buy[t] = Math.max(buy[t], sell[t - 1] - p);
            sell[t] = Math.max(sell[t], buy[t] + p);
        }
    }
    return sell[k];
}
```

### Best Time to Buy and Sell with Transaction Fee
**Category:** Tier 3 · Reference
**Pattern:** State-machine DP  **Time:** O(n)  **Space:** O(1)
**Approach:** Two rolling states: `cash` (not holding) and `hold` (holding). The fee is charged once per completed transaction, conveniently applied at sell time. Per day: `cash = max(cash, hold + price - fee)` (sell, pay fee) and `hold = max(hold, cash - price)` (buy). Start `hold = -prices[0]`. The final `cash` is the answer.

```java
public int maxProfit(int[] prices, int fee) {
    int cash = 0, hold = -prices[0];
    for (int i = 1; i < prices.length; i++) {
        cash = Math.max(cash, hold + prices[i] - fee);
        hold = Math.max(hold, cash - prices[i]);
    }
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

```java
public boolean canPartitionKSubsets(int[] nums, int k) {
    int total = 0;
    for (int x : nums) total += x;
    if (total % k != 0) return false;
    int target = total / k, n = nums.length;
    int[] dp = new int[1 << n];
    Arrays.fill(dp, -1);
    dp[0] = 0;                                   // empty: bucket sum 0
    for (int mask = 0; mask < (1 << n); mask++) {
        if (dp[mask] == -1) continue;
        for (int i = 0; i < n; i++) {
            if ((mask & (1 << i)) != 0) continue;        // already used
            if (dp[mask] + nums[i] <= target) {
                int next = mask | (1 << i);
                if (dp[next] == -1)
                    dp[next] = (dp[mask] + nums[i]) % target;   // reset on full bucket
            }
        }
    }
    return dp[(1 << n) - 1] == 0;
}
```

### Travelling Salesman Problem (brief)
**Category:** Tier 3 · Reference
**Pattern:** Bitmask DP (Held–Karp)  **Time:** O(n²·2ⁿ)  **Space:** O(n·2ⁿ)
**Approach:** State `dp[mask][i]` = min cost of a path that has visited exactly the cities in `mask` and currently sits at city `i`. Transition: extend to an unvisited city `j` via `dp[mask | (1<<j)][j] = min(..., dp[mask][i] + dist[i][j])`. Start at city 0 (`dp[1][0] = 0`). The answer closes the tour: `min over i of dp[full][i] + dist[i][0]`.

```java
public int tsp(int[][] dist) {
    int n = dist.length, FULL = (1 << n) - 1;
    int[][] dp = new int[1 << n][n];
    for (int[] row : dp) Arrays.fill(row, Integer.MAX_VALUE / 2);
    dp[1][0] = 0;                                 // start at city 0
    for (int mask = 1; mask <= FULL; mask++) {
        for (int i = 0; i < n; i++) {
            if ((mask & (1 << i)) == 0 || dp[mask][i] >= Integer.MAX_VALUE / 2) continue;
            for (int j = 0; j < n; j++) {
                if ((mask & (1 << j)) != 0) continue;
                int next = mask | (1 << j);
                dp[next][j] = Math.min(dp[next][j], dp[mask][i] + dist[i][j]);
            }
        }
    }
    int best = Integer.MAX_VALUE;
    for (int i = 0; i < n; i++)
        best = Math.min(best, dp[FULL][i] + dist[i][0]);
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

```java
public int rob(TreeNode root) {
    int[] r = dfs(root);
    return Math.max(r[0], r[1]);
}
// returns {robThis, skipThis}
private int[] dfs(TreeNode node) {
    if (node == null) return new int[]{0, 0};
    int[] L = dfs(node.left), R = dfs(node.right);
    int rob = node.val + L[1] + R[1];
    int skip = Math.max(L[0], L[1]) + Math.max(R[0], R[1]);
    return new int[]{rob, skip};
}
```

### Binary Tree Cameras
**Category:** Tier 3 · Reference
**Pattern:** Tree DP (greedy state per node)  **Time:** O(n)  **Space:** O(h)
**Approach:** Each node reports one of three states upward: `0` = not covered (needs a parent camera), `1` = covered but has no camera, `2` = has a camera. Post-order: if either child is uncovered (`0`), this node must place a camera (`2`, increment count). If either child has a camera (`2`), this node is covered without one (`1`). Otherwise this node is uncovered (`0`) and relies on its parent. Null children are treated as covered (`1`) so leaves report uncovered. Finally, if the root reports uncovered, add one camera.

```java
private int cameras = 0;
public int minCameraCover(TreeNode root) {
    if (dfs(root) == 0) cameras++;               // root uncovered -> add camera
    return cameras;
}
// 0 = uncovered, 1 = covered (no camera), 2 = has camera
private int dfs(TreeNode node) {
    if (node == null) return 1;                  // null is "covered"
    int l = dfs(node.left), r = dfs(node.right);
    if (l == 0 || r == 0) { cameras++; return 2; }   // a child needs coverage
    if (l == 2 || r == 2) return 1;                  // covered by a child's camera
    return 0;                                        // both children covered, this isn't
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
