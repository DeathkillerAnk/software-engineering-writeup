# 04 · Binary Search & Backtracking

Templates and worked problems for binary search (sorted, on-answer, rotated, 2D), recursion, and backtracking.

---

## Canonical Binary Search Templates

Always prefer `lo + (hi - lo) / 2` over `(lo + hi) / 2` to avoid integer overflow.

### lower_bound — first index where `a[i] >= target`
**Category:** 🧩 Template
Returns `n` if no such index. Half-open interval `[lo, hi)`.

```java
static int lowerBound(int[] a, int target) {
    int lo = 0, hi = a.length; // hi is exclusive
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (a[mid] < target) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}
```

### upper_bound — first index where `a[i] > target`
**Category:** 🧩 Template
Returns `n` if no such index.

```java
static int upperBound(int[] a, int target) {
    int lo = 0, hi = a.length;
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (a[mid] <= target) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}
```

### Binary Search on Answer
**Category:** 🧩 Template
When the answer is a number in a monotonic range: `feasible(x)` is false for small x then true for all larger x (or vice versa). Search for the boundary.

```java
// Find smallest x in [lo, hi] with feasible(x) == true.
static int searchAnswer(int lo, int hi) {
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (feasible(mid)) hi = mid;   // mid works, try smaller
        else lo = mid + 1;             // mid too small, go bigger
    }
    return lo; // smallest feasible value
}
```

---

# Binary Search

**When to use:** The array is sorted (or has some monotonic structure you can exploit), and you need O(log n) lookup, boundary, or rotation-pivot logic.

### Binary Search (classic)
**Category:** ⭐ Tier 1 · Core
**Pattern:** Binary Search  **Time:** O(log n)  **Space:** O(1)
**Approach:** Maintain an inclusive `[lo, hi]` window. Compare the midpoint to the target and discard the half that cannot contain it. Stop when the window is empty.

```java
class Solution {
    public int search(int[] nums, int target) {
        int lo = 0, hi = nums.length - 1;
        while (lo <= hi) {
            int mid = lo + (hi - lo) / 2;
            if (nums[mid] == target) return mid;
            else if (nums[mid] < target) lo = mid + 1;
            else hi = mid - 1;
        }
        return -1;
    }
}
```

### Search Insert Position
**Category:** Tier 3 · Reference
**Pattern:** lower_bound  **Time:** O(log n)  **Space:** O(1)
**Approach:** The insert position is exactly the first index whose value is `>= target`, i.e. `lower_bound`. If the target is larger than everything, the answer is `n`, which the half-open template returns naturally.

```java
class Solution {
    public int searchInsert(int[] nums, int target) {
        int lo = 0, hi = nums.length; // exclusive
        while (lo < hi) {
            int mid = lo + (hi - lo) / 2;
            if (nums[mid] < target) lo = mid + 1;
            else hi = mid;
        }
        return lo;
    }
}
```

### Find First and Last Position of Element
**Category:** ⭐ Tier 1 · Core
**Pattern:** lower_bound + upper_bound  **Time:** O(log n)  **Space:** O(1)
**Approach:** The first occurrence is `lower_bound(target)`; the last is `upper_bound(target) - 1`. If `lower_bound` lands out of range or on a different value, the target is absent and we return `[-1, -1]`.

```java
class Solution {
    public int[] searchRange(int[] nums, int target) {
        int first = lowerBound(nums, target);
        if (first == nums.length || nums[first] != target)
            return new int[]{-1, -1};
        int last = upperBound(nums, target) - 1;
        return new int[]{first, last};
    }

    private int lowerBound(int[] a, int t) {
        int lo = 0, hi = a.length;
        while (lo < hi) {
            int mid = lo + (hi - lo) / 2;
            if (a[mid] < t) lo = mid + 1; else hi = mid;
        }
        return lo;
    }

    private int upperBound(int[] a, int t) {
        int lo = 0, hi = a.length;
        while (lo < hi) {
            int mid = lo + (hi - lo) / 2;
            if (a[mid] <= t) lo = mid + 1; else hi = mid;
        }
        return lo;
    }
}
```

### Search in Rotated Sorted Array
**Category:** ⭐ Tier 1 · Core
**Pattern:** Modified Binary Search  **Time:** O(log n)  **Space:** O(1)
**Approach:** At each step one half `[lo, mid]` or `[mid, hi]` is guaranteed sorted. Detect the sorted half by comparing `nums[lo]` with `nums[mid]`, then check whether the target falls inside that sorted half's range; recurse into whichever half could contain it.

```java
class Solution {
    public int search(int[] nums, int target) {
        int lo = 0, hi = nums.length - 1;
        while (lo <= hi) {
            int mid = lo + (hi - lo) / 2;
            if (nums[mid] == target) return mid;
            if (nums[lo] <= nums[mid]) {            // left half sorted
                if (nums[lo] <= target && target < nums[mid]) hi = mid - 1;
                else lo = mid + 1;
            } else {                                // right half sorted
                if (nums[mid] < target && target <= nums[hi]) lo = mid + 1;
                else hi = mid - 1;
            }
        }
        return -1;
    }
}
```

### Find Minimum in Rotated Sorted Array
**Category:** Tier 2 · Reinforce
**Pattern:** Binary Search on pivot  **Time:** O(log n)  **Space:** O(1)
**Approach:** The minimum is the single "inflection" point. Compare `nums[mid]` to `nums[hi]`: if `nums[mid] > nums[hi]` the minimum lies strictly to the right of mid; otherwise it is at mid or to its left. Converge until `lo == hi`.

```java
class Solution {
    public int findMin(int[] nums) {
        int lo = 0, hi = nums.length - 1;
        while (lo < hi) {
            int mid = lo + (hi - lo) / 2;
            if (nums[mid] > nums[hi]) lo = mid + 1;
            else hi = mid;
        }
        return nums[lo];
    }
}
```
**Alternative:** With duplicates (LC 154) add `else hi--` when `nums[mid] == nums[hi]`, degrading worst case to O(n).

### Search a 2D Matrix
**Category:** Tier 2 · Reinforce
**Pattern:** Binary Search on flattened index  **Time:** O(log(m·n))  **Space:** O(1)
**Approach:** Rows are sorted and each row's first element exceeds the previous row's last, so the matrix is one sorted sequence. Binary search over `[0, m*n)` and map a flat index `idx` to `(idx / cols, idx % cols)`.

```java
class Solution {
    public boolean searchMatrix(int[][] matrix, int target) {
        int m = matrix.length, n = matrix[0].length;
        int lo = 0, hi = m * n - 1;
        while (lo <= hi) {
            int mid = lo + (hi - lo) / 2;
            int val = matrix[mid / n][mid % n];
            if (val == target) return true;
            else if (val < target) lo = mid + 1;
            else hi = mid - 1;
        }
        return false;
    }
}
```

### Search a 2D Matrix II
**Category:** Tier 3 · Reference
**Pattern:** Staircase search  **Time:** O(m + n)  **Space:** O(1)
**Approach:** Rows and columns are each sorted but rows do not chain into one sequence. Start at the top-right corner: if the value is larger than the target move left (eliminate a column), if smaller move down (eliminate a row). Each step removes one row or column.

```java
class Solution {
    public boolean searchMatrix(int[][] matrix, int target) {
        int r = 0, c = matrix[0].length - 1;
        while (r < matrix.length && c >= 0) {
            int val = matrix[r][c];
            if (val == target) return true;
            else if (val > target) c--;
            else r++;
        }
        return false;
    }
}
```

### Median of Two Sorted Arrays
**Category:** Tier 2 · Reinforce
**Pattern:** Binary Search on partition  **Time:** O(log(min(m, n)))  **Space:** O(1)
**Approach:** Binary search a cut in the smaller array; the cut in the larger array is forced so the left side holds exactly half the elements. A valid partition satisfies `maxLeftA <= minRightB` and `maxLeftB <= minRightA`. From those four boundary values the median follows directly.

```java
class Solution {
    public double findMedianSortedArrays(int[] A, int[] B) {
        if (A.length > B.length) { int[] t = A; A = B; B = t; }
        int m = A.length, n = B.length, half = (m + n + 1) / 2;
        int lo = 0, hi = m;
        while (lo <= hi) {
            int i = lo + (hi - lo) / 2; // cut in A
            int j = half - i;           // cut in B
            int maxLeftA  = (i == 0) ? Integer.MIN_VALUE : A[i - 1];
            int minRightA = (i == m) ? Integer.MAX_VALUE : A[i];
            int maxLeftB  = (j == 0) ? Integer.MIN_VALUE : B[j - 1];
            int minRightB = (j == n) ? Integer.MAX_VALUE : B[j];
            if (maxLeftA <= minRightB && maxLeftB <= minRightA) {
                if (((m + n) & 1) == 1)
                    return Math.max(maxLeftA, maxLeftB);
                return (Math.max(maxLeftA, maxLeftB)
                      + Math.min(minRightA, minRightB)) / 2.0;
            } else if (maxLeftA > minRightB) {
                hi = i - 1;
            } else {
                lo = i + 1;
            }
        }
        throw new IllegalArgumentException("Input arrays not sorted");
    }
}
```

---

# Binary Search on Answer

**When to use:** You are not searching an array but a numeric answer (speed, capacity, size) where a predicate `feasible(x)` is monotonic. Search the value space for the boundary between infeasible and feasible.

### Koko Eating Bananas
**Category:** ⭐ Tier 1 · Core
**Pattern:** Binary Search on answer  **Time:** O(n · log(max pile))  **Space:** O(1)
**Approach:** Eating speed is monotonic: a faster speed never needs more hours. Search speeds in `[1, max(piles)]` for the smallest `k` where total hours `sum(ceil(pile / k))` is `<= h`.

```java
class Solution {
    public int minEatingSpeed(int[] piles, int h) {
        int lo = 1, hi = 0;
        for (int p : piles) hi = Math.max(hi, p);
        while (lo < hi) {
            int mid = lo + (hi - lo) / 2;
            if (hoursNeeded(piles, mid) <= h) hi = mid;
            else lo = mid + 1;
        }
        return lo;
    }

    private long hoursNeeded(int[] piles, int k) {
        long hours = 0;
        for (int p : piles) hours += (p + k - 1) / k; // ceil division
        return hours;
    }
}
```

### Capacity to Ship Packages Within D Days
**Category:** Tier 2 · Reinforce
**Pattern:** Binary Search on answer  **Time:** O(n · log(sum))  **Space:** O(1)
**Approach:** A larger ship capacity never needs more days, so days-needed is monotonic in capacity. The capacity must be at least `max(weights)` (to fit the biggest package) and at most `sum(weights)`. Search that range for the smallest capacity shippable within `days`.

```java
class Solution {
    public int shipWithinDays(int[] weights, int days) {
        int lo = 0, hi = 0;
        for (int w : weights) { lo = Math.max(lo, w); hi += w; }
        while (lo < hi) {
            int mid = lo + (hi - lo) / 2;
            if (daysNeeded(weights, mid) <= days) hi = mid;
            else lo = mid + 1;
        }
        return lo;
    }

    private int daysNeeded(int[] weights, int cap) {
        int days = 1, load = 0;
        for (int w : weights) {
            if (load + w > cap) { days++; load = 0; }
            load += w;
        }
        return days;
    }
}
```

### Split Array Largest Sum
**Category:** Tier 3 · Reference
**Pattern:** Binary Search on answer  **Time:** O(n · log(sum))  **Space:** O(1)
**Approach:** Minimize the largest subarray sum over `k` contiguous splits. For a candidate max sum, greedily count how many subarrays are needed; fewer needed means the candidate is feasible. Search candidates in `[max(nums), sum(nums)]` for the smallest feasible one (identical machinery to ship-packages).

```java
class Solution {
    public int splitArray(int[] nums, int k) {
        int lo = 0, hi = 0;
        for (int x : nums) { lo = Math.max(lo, x); hi += x; }
        while (lo < hi) {
            int mid = lo + (hi - lo) / 2;
            if (partitions(nums, mid) <= k) hi = mid;
            else lo = mid + 1;
        }
        return lo;
    }

    private int partitions(int[] nums, int maxSum) {
        int count = 1, sum = 0;
        for (int x : nums) {
            if (sum + x > maxSum) { count++; sum = 0; }
            sum += x;
        }
        return count;
    }
}
```

### Find Peak Element
**Category:** Tier 3 · Reference
**Pattern:** Binary Search on slope  **Time:** O(log n)  **Space:** O(1)
**Approach:** Any element greater than both neighbors is a peak; with `nums[-1] = nums[n] = -inf` a peak always exists. If `nums[mid] < nums[mid+1]` an ascending slope guarantees a peak to the right, so move right; otherwise a peak is at mid or to its left.

```java
class Solution {
    public int findPeakElement(int[] nums) {
        int lo = 0, hi = nums.length - 1;
        while (lo < hi) {
            int mid = lo + (hi - lo) / 2;
            if (nums[mid] < nums[mid + 1]) lo = mid + 1;
            else hi = mid;
        }
        return lo;
    }
}
```

---

# Backtracking

**When to use:** You must enumerate or search combinatorial structures (subsets, permutations, partitions, board placements). Build a candidate incrementally, recurse, and undo the choice (backtrack) to explore alternatives.

### General Backtracking Template
**Category:** 🧩 Template
```java
void backtrack(State state, List<Solution> results) {
    if (isComplete(state)) {
        results.add(snapshot(state)); // copy current state
        return;
    }
    for (Choice choice : choices(state)) {
        if (!valid(state, choice)) continue;
        apply(state, choice);          // make the choice
        backtrack(state, results);     // recurse
        undo(state, choice);           // undo the choice
    }
}
```
Key levers: start index (avoid reusing earlier elements), `i > start && nums[i] == nums[i-1]` to skip duplicates on a sorted array, and a `used[]` array for permutations.

### Subsets
**Category:** ⭐ Tier 1 · Core
**Pattern:** Backtracking (include/exclude)  **Time:** O(n · 2^n)  **Space:** O(n) recursion
**Approach:** Every element is either in or out of a subset. Recurse from a `start` index, recording the current path at every node of the tree (not just leaves), and advance the index so each element is considered once.

```java
class Solution {
    public List<List<Integer>> subsets(int[] nums) {
        List<List<Integer>> res = new ArrayList<>();
        backtrack(nums, 0, new ArrayList<>(), res);
        return res;
    }

    private void backtrack(int[] nums, int start, List<Integer> path,
                           List<List<Integer>> res) {
        res.add(new ArrayList<>(path));
        for (int i = start; i < nums.length; i++) {
            path.add(nums[i]);
            backtrack(nums, i + 1, path, res);
            path.remove(path.size() - 1);
        }
    }
}
```

### Subsets II (dups)
**Category:** Tier 2 · Reinforce
**Pattern:** Backtracking + dedup  **Time:** O(n · 2^n)  **Space:** O(n)
**Approach:** Sort so equal values are adjacent. Within the same recursion level, skip any element equal to its predecessor (`i > start && nums[i] == nums[i-1]`); this prevents generating two subsets that differ only by which copy of a duplicate was chosen.

```java
class Solution {
    public List<List<Integer>> subsetsWithDup(int[] nums) {
        Arrays.sort(nums);
        List<List<Integer>> res = new ArrayList<>();
        backtrack(nums, 0, new ArrayList<>(), res);
        return res;
    }

    private void backtrack(int[] nums, int start, List<Integer> path,
                           List<List<Integer>> res) {
        res.add(new ArrayList<>(path));
        for (int i = start; i < nums.length; i++) {
            if (i > start && nums[i] == nums[i - 1]) continue;
            path.add(nums[i]);
            backtrack(nums, i + 1, path, res);
            path.remove(path.size() - 1);
        }
    }
}
```

### Permutations
**Category:** ⭐ Tier 1 · Core
**Pattern:** Backtracking + used[]  **Time:** O(n · n!)  **Space:** O(n)
**Approach:** A permutation uses every element exactly once in some order. Track used elements with a boolean array; at each position try every unused element, recurse, then release it.

```java
class Solution {
    public List<List<Integer>> permute(int[] nums) {
        List<List<Integer>> res = new ArrayList<>();
        backtrack(nums, new boolean[nums.length], new ArrayList<>(), res);
        return res;
    }

    private void backtrack(int[] nums, boolean[] used, List<Integer> path,
                           List<List<Integer>> res) {
        if (path.size() == nums.length) {
            res.add(new ArrayList<>(path));
            return;
        }
        for (int i = 0; i < nums.length; i++) {
            if (used[i]) continue;
            used[i] = true;
            path.add(nums[i]);
            backtrack(nums, used, path, res);
            path.remove(path.size() - 1);
            used[i] = false;
        }
    }
}
```

### Permutations II (dups)
**Category:** Tier 2 · Reinforce
**Pattern:** Backtracking + used[] + dedup  **Time:** O(n · n!)  **Space:** O(n)
**Approach:** Sort the array, then within each level skip a duplicate value unless its identical predecessor has already been placed in this branch (`i > 0 && nums[i] == nums[i-1] && !used[i-1]`). This fixes a canonical order among equal elements so each distinct permutation is produced once.

```java
class Solution {
    public List<List<Integer>> permuteUnique(int[] nums) {
        Arrays.sort(nums);
        List<List<Integer>> res = new ArrayList<>();
        backtrack(nums, new boolean[nums.length], new ArrayList<>(), res);
        return res;
    }

    private void backtrack(int[] nums, boolean[] used, List<Integer> path,
                           List<List<Integer>> res) {
        if (path.size() == nums.length) {
            res.add(new ArrayList<>(path));
            return;
        }
        for (int i = 0; i < nums.length; i++) {
            if (used[i]) continue;
            if (i > 0 && nums[i] == nums[i - 1] && !used[i - 1]) continue;
            used[i] = true;
            path.add(nums[i]);
            backtrack(nums, used, path, res);
            path.remove(path.size() - 1);
            used[i] = false;
        }
    }
}
```

### Combinations
**Category:** Tier 3 · Reference
**Pattern:** Backtracking with start index  **Time:** O(k · C(n, k))  **Space:** O(k)
**Approach:** Choose `k` of `n` numbers in increasing order. Recurse from a `start` index so combinations are generated in sorted order without repeats. Prune: stop early if remaining numbers cannot complete a size-`k` set.

```java
class Solution {
    public List<List<Integer>> combine(int n, int k) {
        List<List<Integer>> res = new ArrayList<>();
        backtrack(n, k, 1, new ArrayList<>(), res);
        return res;
    }

    private void backtrack(int n, int k, int start, List<Integer> path,
                           List<List<Integer>> res) {
        if (path.size() == k) {
            res.add(new ArrayList<>(path));
            return;
        }
        // prune: need (k - path.size()) more numbers
        for (int i = start; i <= n - (k - path.size()) + 1; i++) {
            path.add(i);
            backtrack(n, k, i + 1, path, res);
            path.remove(path.size() - 1);
        }
    }
}
```

### Combination Sum
**Category:** ⭐ Tier 1 · Core
**Pattern:** Backtracking with reuse  **Time:** O(n^(target/min))  **Space:** O(target/min)
**Approach:** Numbers may be reused, so recurse passing `i` (not `i+1`) to allow picking the same element again. Subtract from the remaining target; prune when it goes negative and record a solution when it hits zero.

```java
class Solution {
    public List<List<Integer>> combinationSum(int[] candidates, int target) {
        List<List<Integer>> res = new ArrayList<>();
        Arrays.sort(candidates);
        backtrack(candidates, target, 0, new ArrayList<>(), res);
        return res;
    }

    private void backtrack(int[] c, int remain, int start, List<Integer> path,
                           List<List<Integer>> res) {
        if (remain == 0) { res.add(new ArrayList<>(path)); return; }
        for (int i = start; i < c.length; i++) {
            if (c[i] > remain) break;          // sorted: rest are larger too
            path.add(c[i]);
            backtrack(c, remain - c[i], i, path, res); // reuse: stay at i
            path.remove(path.size() - 1);
        }
    }
}
```

### Combination Sum II
**Category:** Tier 3 · Reference
**Pattern:** Backtracking + dedup, no reuse  **Time:** O(2^n)  **Space:** O(n)
**Approach:** Each number is used at most once, and the input has duplicates. Sort, recurse with `i+1` to forbid reuse, and skip same-level duplicates (`i > start && c[i] == c[i-1]`) so equal candidates do not generate identical combinations.

```java
class Solution {
    public List<List<Integer>> combinationSum2(int[] candidates, int target) {
        List<List<Integer>> res = new ArrayList<>();
        Arrays.sort(candidates);
        backtrack(candidates, target, 0, new ArrayList<>(), res);
        return res;
    }

    private void backtrack(int[] c, int remain, int start, List<Integer> path,
                           List<List<Integer>> res) {
        if (remain == 0) { res.add(new ArrayList<>(path)); return; }
        for (int i = start; i < c.length; i++) {
            if (i > start && c[i] == c[i - 1]) continue;
            if (c[i] > remain) break;
            path.add(c[i]);
            backtrack(c, remain - c[i], i + 1, path, res); // no reuse
            path.remove(path.size() - 1);
        }
    }
}
```

### Letter Combinations of a Phone Number
**Category:** Tier 2 · Reinforce
**Pattern:** Backtracking over digit map  **Time:** O(4^n · n)  **Space:** O(n)
**Approach:** Map each digit to its letters and build strings position by position. At depth `d` iterate over the letters of `digits[d]`, append one, recurse, then remove it. The leaf at depth `digits.length()` is a complete combination.

```java
class Solution {
    private static final String[] MAP = {
        "", "", "abc", "def", "ghi", "jkl", "mno", "pqrs", "tuv", "wxyz"
    };

    public List<String> letterCombinations(String digits) {
        List<String> res = new ArrayList<>();
        if (digits.isEmpty()) return res;
        backtrack(digits, 0, new StringBuilder(), res);
        return res;
    }

    private void backtrack(String digits, int idx, StringBuilder sb,
                           List<String> res) {
        if (idx == digits.length()) { res.add(sb.toString()); return; }
        String letters = MAP[digits.charAt(idx) - '0'];
        for (char ch : letters.toCharArray()) {
            sb.append(ch);
            backtrack(digits, idx + 1, sb, res);
            sb.deleteCharAt(sb.length() - 1);
        }
    }
}
```

### Generate Parentheses
**Category:** Tier 2 · Reinforce
**Pattern:** Backtracking with validity counts  **Time:** O(4^n / sqrt(n))  **Space:** O(n)
**Approach:** Track how many `(` and `)` remain. You may add `(` while opens remain, and `)` only while closes outnumber opens left (i.e. there is an unmatched open). This guarantees every generated string is balanced.

```java
class Solution {
    public List<String> generateParenthesis(int n) {
        List<String> res = new ArrayList<>();
        backtrack(n, n, new StringBuilder(), res);
        return res;
    }

    private void backtrack(int open, int close, StringBuilder sb,
                           List<String> res) {
        if (open == 0 && close == 0) { res.add(sb.toString()); return; }
        if (open > 0) {
            sb.append('(');
            backtrack(open - 1, close, sb, res);
            sb.deleteCharAt(sb.length() - 1);
        }
        if (close > open) {
            sb.append(')');
            backtrack(open, close - 1, sb, res);
            sb.deleteCharAt(sb.length() - 1);
        }
    }
}
```

### Palindrome Partitioning
**Category:** Tier 2 · Reinforce
**Pattern:** Backtracking on cut points  **Time:** O(n · 2^n)  **Space:** O(n)
**Approach:** Try every prefix `s[start..i]` as the next piece; if it is a palindrome, recurse on the remainder. Each valid full path from index 0 to `n` is one partition into palindromes.

```java
class Solution {
    public List<List<String>> partition(String s) {
        List<List<String>> res = new ArrayList<>();
        backtrack(s, 0, new ArrayList<>(), res);
        return res;
    }

    private void backtrack(String s, int start, List<String> path,
                           List<List<String>> res) {
        if (start == s.length()) { res.add(new ArrayList<>(path)); return; }
        for (int i = start; i < s.length(); i++) {
            if (!isPalindrome(s, start, i)) continue;
            path.add(s.substring(start, i + 1));
            backtrack(s, i + 1, path, res);
            path.remove(path.size() - 1);
        }
    }

    private boolean isPalindrome(String s, int l, int r) {
        while (l < r) if (s.charAt(l++) != s.charAt(r--)) return false;
        return true;
    }
}
```
**Alternative:** Precompute an `isPal[i][j]` DP table to make each palindrome check O(1), reducing total time to O(2^n).

### Word Search
**Category:** ⭐ Tier 1 · Core
**Pattern:** Backtracking / DFS on grid  **Time:** O(m·n·4^L)  **Space:** O(L) recursion
**Approach:** From each cell, DFS in four directions matching the word character by character. Mark visited cells in place (overwrite then restore) to avoid reuse within a single path. Return true as soon as any path spells the full word.

```java
class Solution {
    public boolean exist(char[][] board, String word) {
        int m = board.length, n = board[0].length;
        for (int r = 0; r < m; r++)
            for (int c = 0; c < n; c++)
                if (dfs(board, word, 0, r, c)) return true;
        return false;
    }

    private boolean dfs(char[][] b, String w, int idx, int r, int c) {
        if (idx == w.length()) return true;
        if (r < 0 || c < 0 || r >= b.length || c >= b[0].length
            || b[r][c] != w.charAt(idx)) return false;
        char tmp = b[r][c];
        b[r][c] = '#'; // mark visited
        boolean found = dfs(b, w, idx + 1, r + 1, c)
                     || dfs(b, w, idx + 1, r - 1, c)
                     || dfs(b, w, idx + 1, r, c + 1)
                     || dfs(b, w, idx + 1, r, c - 1);
        b[r][c] = tmp; // restore
        return found;
    }
}
```

### N-Queens
**Category:** Tier 2 · Reinforce
**Pattern:** Backtracking + constraint sets  **Time:** O(n!)  **Space:** O(n)
**Approach:** Place one queen per row. Track attacked columns and both diagonals (`row - col` and `row + col`) in sets for O(1) conflict checks. When a column is safe, place, recurse to the next row, then undo.

```java
class Solution {
    public List<List<String>> solveNQueens(int n) {
        List<List<String>> res = new ArrayList<>();
        int[] queens = new int[n];        // queens[r] = column
        boolean[] cols = new boolean[n];
        boolean[] diag = new boolean[2 * n];  // row + col
        boolean[] anti = new boolean[2 * n];  // row - col + n
        backtrack(0, n, queens, cols, diag, anti, res);
        return res;
    }

    private void backtrack(int row, int n, int[] queens, boolean[] cols,
                           boolean[] diag, boolean[] anti,
                           List<List<String>> res) {
        if (row == n) { res.add(build(queens, n)); return; }
        for (int col = 0; col < n; col++) {
            int d = row + col, a = row - col + n;
            if (cols[col] || diag[d] || anti[a]) continue;
            queens[row] = col;
            cols[col] = diag[d] = anti[a] = true;
            backtrack(row + 1, n, queens, cols, diag, anti, res);
            cols[col] = diag[d] = anti[a] = false;
        }
    }

    private List<String> build(int[] queens, int n) {
        List<String> board = new ArrayList<>();
        for (int r = 0; r < n; r++) {
            char[] line = new char[n];
            Arrays.fill(line, '.');
            line[queens[r]] = 'Q';
            board.add(new String(line));
        }
        return board;
    }
}
```

### Sudoku Solver
**Category:** Tier 3 · Reference
**Pattern:** Backtracking + constraint check  **Time:** O(9^(empty cells))  **Space:** O(1) board in place
**Approach:** Find the next empty cell, try digits 1–9, and keep only those valid for the current row, column, and 3×3 box. Recurse; if the recursion fully fills the board, propagate success, otherwise reset the cell and try the next digit.

```java
class Solution {
    public void solveSudoku(char[][] board) {
        solve(board);
    }

    private boolean solve(char[][] b) {
        for (int r = 0; r < 9; r++) {
            for (int c = 0; c < 9; c++) {
                if (b[r][c] != '.') continue;
                for (char d = '1'; d <= '9'; d++) {
                    if (!valid(b, r, c, d)) continue;
                    b[r][c] = d;
                    if (solve(b)) return true;
                    b[r][c] = '.';
                }
                return false; // no digit fits here
            }
        }
        return true; // no empty cell left
    }

    private boolean valid(char[][] b, int r, int c, char d) {
        int br = (r / 3) * 3, bc = (c / 3) * 3;
        for (int i = 0; i < 9; i++) {
            if (b[r][i] == d || b[i][c] == d) return false;
            if (b[br + i / 3][bc + i % 3] == d) return false;
        }
        return true;
    }
}
```

### Restore IP Addresses
**Category:** Tier 3 · Reference
**Pattern:** Backtracking on segments  **Time:** O(1) (bounded ≤ 3^4)  **Space:** O(1)
**Approach:** Split the string into exactly 4 segments. Each segment is 1–3 digits, value `<= 255`, and has no leading zero (unless it is exactly "0"). Recurse over segment lengths and stop when 4 valid segments consume the whole string.

```java
class Solution {
    public List<String> restoreIpAddresses(String s) {
        List<String> res = new ArrayList<>();
        backtrack(s, 0, 0, new StringBuilder(), res);
        return res;
    }

    private void backtrack(String s, int start, int part, StringBuilder sb,
                           List<String> res) {
        if (part == 4) {
            if (start == s.length()) res.add(sb.substring(0, sb.length() - 1));
            return;
        }
        for (int len = 1; len <= 3 && start + len <= s.length(); len++) {
            String seg = s.substring(start, start + len);
            if (seg.length() > 1 && seg.charAt(0) == '0') break; // leading zero
            if (Integer.parseInt(seg) > 255) break;
            int mark = sb.length();
            sb.append(seg).append('.');
            backtrack(s, start + len, part + 1, sb, res);
            sb.setLength(mark); // undo
        }
    }
}
```
