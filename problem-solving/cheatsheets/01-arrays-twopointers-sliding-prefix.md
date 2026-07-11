# 01 · Arrays, Two Pointers, Sliding Window & Prefix Sum

A pattern-first cheatsheet for the core array techniques: two pointers, sliding window, prefix sums, Kadane, and cyclic sort — each with a recognition note, a reusable template, and worked signature problems in idiomatic Java.

---

## 1. Two Pointers — Opposite Ends

**When to use / how to recognize it:** The input is sorted (or sortable) and you want a pair/triple meeting a condition, or you must shrink a range from both sides (palindrome, water container). Start one pointer at index `0`, one at `n-1`, and move them toward each other based on a comparison. Turns an O(n²) pair search into O(n).

**Template:**
```java
int lo = 0, hi = arr.length - 1;
while (lo < hi) {
    int sum = arr[lo] + arr[hi];
    if (sum == target) { /* found */ break; }
    else if (sum < target) lo++;   // need bigger
    else hi--;                      // need smaller
}
```

### Two Sum II (Input Array Is Sorted)
**Category:** Tier 2 · Reinforce
**Pattern:** Two pointers opposite ends  **Time:** O(n)  **Space:** O(1)
**Approach:** Because the array is sorted, place pointers at both ends. If the sum is too small, the only way to increase it is to move the left pointer right; if too large, move the right pointer left. Each element is visited at most once, so it is linear and needs no hash map.

```java
public int[] twoSum(int[] numbers, int target) {
    int lo = 0, hi = numbers.length - 1;
    while (lo < hi) {
        int sum = numbers[lo] + numbers[hi];
        if (sum == target) return new int[]{lo + 1, hi + 1}; // 1-indexed
        else if (sum < target) lo++;
        else hi--;
    }
    return new int[]{-1, -1};
}
```

### 3Sum
**Category:** ⭐ Tier 1 · Core
**Pattern:** Sort + two pointers opposite ends  **Time:** O(n²)  **Space:** O(1) (excluding output)
**Approach:** Sort the array, then fix each index `i` and run a two-pointer scan on the remainder looking for pairs summing to `-nums[i]`. Skip duplicate values for both the fixed element and the moving pointers to avoid duplicate triplets. Once `nums[i] > 0` we can stop, since all remaining numbers are positive.

```java
public List<List<Integer>> threeSum(int[] nums) {
    Arrays.sort(nums);
    List<List<Integer>> res = new ArrayList<>();
    for (int i = 0; i < nums.length - 2; i++) {
        if (nums[i] > 0) break;
        if (i > 0 && nums[i] == nums[i - 1]) continue; // skip dup pivots
        int lo = i + 1, hi = nums.length - 1;
        while (lo < hi) {
            int sum = nums[i] + nums[lo] + nums[hi];
            if (sum == 0) {
                res.add(Arrays.asList(nums[i], nums[lo], nums[hi]));
                while (lo < hi && nums[lo] == nums[lo + 1]) lo++;
                while (lo < hi && nums[hi] == nums[hi - 1]) hi--;
                lo++; hi--;
            } else if (sum < 0) lo++;
            else hi--;
        }
    }
    return res;
}
```

### Container With Most Water
**Category:** ⭐ Tier 1 · Core
**Pattern:** Two pointers opposite ends  **Time:** O(n)  **Space:** O(1)
**Approach:** Area is `min(height[lo], height[hi]) * (hi - lo)`. Start at the widest pair. Moving the taller wall inward can never help (width shrinks, height capped by the shorter wall), so always move the shorter wall — that is the only move that could yield a taller bottleneck and a larger area.

```java
public int maxArea(int[] height) {
    int lo = 0, hi = height.length - 1, best = 0;
    while (lo < hi) {
        int area = Math.min(height[lo], height[hi]) * (hi - lo);
        best = Math.max(best, area);
        if (height[lo] < height[hi]) lo++;
        else hi--;
    }
    return best;
}
```

### Trapping Rain Water
**Category:** ⭐ Tier 1 · Core
**Pattern:** Two pointers opposite ends  **Time:** O(n)  **Space:** O(1)
**Approach:** Water above a bar equals `min(maxLeft, maxRight) - height[i]`. Maintain running `leftMax`/`rightMax`. Whichever side has the smaller wall is the binding constraint, so we can safely compute that side's trapped water and advance that pointer — the smaller running max is guaranteed to be the true bound for that cell.

```java
public int trap(int[] height) {
    int lo = 0, hi = height.length - 1;
    int leftMax = 0, rightMax = 0, water = 0;
    while (lo < hi) {
        if (height[lo] < height[hi]) {
            leftMax = Math.max(leftMax, height[lo]);
            water += leftMax - height[lo];
            lo++;
        } else {
            rightMax = Math.max(rightMax, height[hi]);
            water += rightMax - height[hi];
            hi--;
        }
    }
    return water;
}
```

**Alternative (monotonic stack):** Keep a stack of decreasing bar indices. When the current bar is taller than the top, pop it as a "bottom"; the trapped width spans from the new stack top to the current index, bounded in height by `min(left, current) - bottom`. O(n) time, O(n) space.

```java
public int trapStack(int[] height) {
    Deque<Integer> stack = new ArrayDeque<>();
    int water = 0;
    for (int i = 0; i < height.length; i++) {
        while (!stack.isEmpty() && height[i] > height[stack.peek()]) {
            int bottom = stack.pop();
            if (stack.isEmpty()) break;
            int left = stack.peek();
            int width = i - left - 1;
            int bounded = Math.min(height[left], height[i]) - height[bottom];
            water += width * bounded;
        }
        stack.push(i);
    }
    return water;
}
```

### Valid Palindrome
**Category:** Tier 3 · Reference
**Pattern:** Two pointers opposite ends  **Time:** O(n)  **Space:** O(1)
**Approach:** Walk inward from both ends, skipping any non-alphanumeric characters, and compare case-insensitively. If any mismatched pair is found the string is not a palindrome. No extra string allocation is needed.

```java
public boolean isPalindrome(String s) {
    int lo = 0, hi = s.length() - 1;
    while (lo < hi) {
        while (lo < hi && !Character.isLetterOrDigit(s.charAt(lo))) lo++;
        while (lo < hi && !Character.isLetterOrDigit(s.charAt(hi))) hi--;
        if (Character.toLowerCase(s.charAt(lo)) != Character.toLowerCase(s.charAt(hi)))
            return false;
        lo++; hi--;
    }
    return true;
}
```

### Sort Colors (Dutch National Flag)
**Category:** ⭐ Tier 1 · Core
**Pattern:** Three pointers, one pass  **Time:** O(n)  **Space:** O(1)
**Approach:** Maintain three regions: `[0,low)` are 0s, `[low,mid)` are 1s, `(high,end]` are 2s. Scan with `mid`: a 0 swaps into the low region; a 2 swaps into the high region (and do not advance `mid`, since the swapped-in value is unexamined); a 1 stays put. Sorts {0,1,2} in a single pass.

```java
public void sortColors(int[] nums) {
    int low = 0, mid = 0, high = nums.length - 1;
    while (mid <= high) {
        if (nums[mid] == 0) {
            swap(nums, low++, mid++);
        } else if (nums[mid] == 1) {
            mid++;
        } else { // == 2
            swap(nums, mid, high--);
        }
    }
}
private void swap(int[] a, int i, int j) { int t = a[i]; a[i] = a[j]; a[j] = t; }
```

---

## 2. Two Pointers — Same Direction (Fast/Slow Writer)

**When to use / how to recognize it:** You overwrite an array in place by filtering or compacting it. A slow `write` pointer marks where the next kept element goes; a fast `read` pointer scans forward. Useful for in-place removal and partitioning while keeping O(1) space.

**Template:**
```java
int write = 0;
for (int read = 0; read < arr.length; read++) {
    if (keep(arr[read])) {
        arr[write++] = arr[read];
    }
}
// arr[0..write) is the result
```

### Remove Duplicates from Sorted Array
**Category:** Tier 3 · Reference
**Pattern:** Same-direction two pointers  **Time:** O(n)  **Space:** O(1)
**Approach:** Since the array is sorted, duplicates are adjacent. Keep a `write` index pointing at the last unique element; for each `read`, write only when it differs from the previous kept value. Return the new length `write + 1`.

```java
public int removeDuplicates(int[] nums) {
    if (nums.length == 0) return 0;
    int write = 0;
    for (int read = 1; read < nums.length; read++) {
        if (nums[read] != nums[write]) {
            nums[++write] = nums[read];
        }
    }
    return write + 1;
}
```

### Move Zeroes
**Category:** Tier 3 · Reference
**Pattern:** Same-direction two pointers  **Time:** O(n)  **Space:** O(1)
**Approach:** A `write` pointer tracks where the next non-zero belongs. Swap each non-zero element into that slot as you scan; swapping (rather than overwriting) automatically pushes the zeroes to the back while preserving relative order of non-zeros.

```java
public void moveZeroes(int[] nums) {
    int write = 0;
    for (int read = 0; read < nums.length; read++) {
        if (nums[read] != 0) {
            int t = nums[write]; nums[write] = nums[read]; nums[read] = t;
            write++;
        }
    }
}
```

---

## 3. Sliding Window — Fixed Size

**When to use / how to recognize it:** You need a statistic (sum/max/average) over every contiguous subarray of a fixed length `k`. Add the entering element and subtract the leaving element instead of recomputing — O(n) instead of O(n·k).

**Template:**
```java
int windowSum = 0;
for (int i = 0; i < arr.length; i++) {
    windowSum += arr[i];               // include arr[i]
    if (i >= k - 1) {
        // window is arr[i-k+1 .. i]
        result = combine(result, windowSum);
        windowSum -= arr[i - k + 1];   // evict left edge
    }
}
```

### Maximum Sum Subarray of Size K
**Category:** ⭐ Tier 1 · Core
**Pattern:** Fixed sliding window  **Time:** O(n)  **Space:** O(1)
**Approach:** Build the first window of size `k`, then slide one step at a time: add the new right element and remove the old left element, tracking the running maximum. Each element enters and leaves the window exactly once.

```java
public int maxSumSubarray(int[] nums, int k) {
    int windowSum = 0;
    for (int i = 0; i < k; i++) windowSum += nums[i];
    int best = windowSum;
    for (int i = k; i < nums.length; i++) {
        windowSum += nums[i] - nums[i - k];
        best = Math.max(best, windowSum);
    }
    return best;
}
```

---

## 4. Sliding Window — Variable Size

**When to use / how to recognize it:** You want the longest/shortest/optimal contiguous window satisfying a constraint (distinct chars, sum ≥ target, ≤ k of something). Expand `right` to grow the window; while the window is invalid (or to seek the minimum, while it is valid), shrink from `left`. Maintain a frequency map or counter as state.

**Template:**
```java
int left = 0;
Map<Character,Integer> count = new HashMap<>();
for (int right = 0; right < s.length(); right++) {
    char c = s.charAt(right);
    count.merge(c, 1, Integer::sum);       // include right
    while (windowInvalid(count)) {         // shrink until valid
        char d = s.charAt(left++);
        count.merge(d, -1, Integer::sum);
    }
    best = Math.max(best, right - left + 1);
}
```

### Longest Substring Without Repeating Characters
**Category:** ⭐ Tier 1 · Core
**Pattern:** Variable sliding window  **Time:** O(n)  **Space:** O(min(n, charset))
**Approach:** Track the last index seen for each character. When a repeat falls inside the current window, jump `left` to just past the previous occurrence. The window `[left, right]` always holds distinct characters, so its width gives a candidate answer at every step.

```java
public int lengthOfLongestSubstring(String s) {
    Map<Character, Integer> lastSeen = new HashMap<>();
    int left = 0, best = 0;
    for (int right = 0; right < s.length(); right++) {
        char c = s.charAt(right);
        if (lastSeen.containsKey(c) && lastSeen.get(c) >= left) {
            left = lastSeen.get(c) + 1;
        }
        lastSeen.put(c, right);
        best = Math.max(best, right - left + 1);
    }
    return best;
}
```

### Minimum Window Substring
**Category:** ⭐ Tier 1 · Core
**Pattern:** Variable sliding window (shrink-to-minimum)  **Time:** O(n + m)  **Space:** O(charset)
**Approach:** Count required characters of `t`. Expand `right`, decrementing the need; when a character's need reaches zero we have one fully-satisfied char (`formed`). Once all required chars are formed, shrink `left` as far as possible while still valid, recording the smallest window seen.

```java
public String minWindow(String s, String t) {
    if (s.length() < t.length()) return "";
    int[] need = new int[128];
    for (char c : t.toCharArray()) need[c]++;
    int required = t.length();           // total chars still needed
    int left = 0, bestLen = Integer.MAX_VALUE, bestStart = 0;
    for (int right = 0; right < s.length(); right++) {
        if (need[s.charAt(right)]-- > 0) required--;
        while (required == 0) {          // valid window
            if (right - left + 1 < bestLen) {
                bestLen = right - left + 1;
                bestStart = left;
            }
            if (need[s.charAt(left)]++ == 0) required++;
            left++;
        }
    }
    return bestLen == Integer.MAX_VALUE ? "" : s.substring(bestStart, bestStart + bestLen);
}
```

### Longest Repeating Character Replacement
**Category:** Tier 2 · Reinforce
**Pattern:** Variable sliding window  **Time:** O(n)  **Space:** O(1) (26 letters)
**Approach:** A window is valid if `(windowLength - countOfMostFrequentChar) <= k`, i.e. the non-majority chars can all be replaced within budget `k`. Track the max frequency seen. When the window becomes invalid, slide `left` forward by one (never shrinking the best answer, since we only ever grow the window when valid).

```java
public int characterReplacement(String s, int k) {
    int[] freq = new int[26];
    int left = 0, maxFreq = 0, best = 0;
    for (int right = 0; right < s.length(); right++) {
        freq[s.charAt(right) - 'A']++;
        maxFreq = Math.max(maxFreq, freq[s.charAt(right) - 'A']);
        while ((right - left + 1) - maxFreq > k) {
            freq[s.charAt(left) - 'A']--;
            left++;
        }
        best = Math.max(best, right - left + 1);
    }
    return best;
}
```

### Minimum Size Subarray Sum
**Category:** Tier 2 · Reinforce
**Pattern:** Variable sliding window (shrink-to-minimum)  **Time:** O(n)  **Space:** O(1)
**Approach:** Grow a running sum by adding `right`. Whenever the sum reaches `target`, shrink from `left` as much as possible while still ≥ target, recording the shortest length each time. Works because all elements are positive, so shrinking strictly decreases the sum.

```java
public int minSubArrayLen(int target, int[] nums) {
    int left = 0, sum = 0, best = Integer.MAX_VALUE;
    for (int right = 0; right < nums.length; right++) {
        sum += nums[right];
        while (sum >= target) {
            best = Math.min(best, right - left + 1);
            sum -= nums[left++];
        }
    }
    return best == Integer.MAX_VALUE ? 0 : best;
}
```

### Fruit Into Baskets
**Category:** Tier 2 · Reinforce
**Pattern:** Variable sliding window (at most 2 distinct)  **Time:** O(n)  **Space:** O(1)
**Approach:** This is "longest subarray with at most 2 distinct values." Keep a frequency map of fruit types in the window; when more than 2 types appear, shrink from the left, removing types whose count hits zero. The widest valid window is the answer.

```java
public int totalFruit(int[] fruits) {
    Map<Integer, Integer> count = new HashMap<>();
    int left = 0, best = 0;
    for (int right = 0; right < fruits.length; right++) {
        count.merge(fruits[right], 1, Integer::sum);
        while (count.size() > 2) {
            int f = fruits[left++];
            if (count.merge(f, -1, Integer::sum) == 0) count.remove(f);
        }
        best = Math.max(best, right - left + 1);
    }
    return best;
}
```

---

## 5. Prefix Sum

**When to use / how to recognize it:** You need many range-sum queries, or you count/locate subarrays whose sum equals a value. Precompute cumulative sums so any range is an O(1) subtraction; pairing prefix sums with a hash map turns "subarray with sum X" into a one-pass counting problem.

**Template:**
```java
// 1D immutable range sum
int[] prefix = new int[n + 1];           // prefix[i] = sum of arr[0..i-1]
for (int i = 0; i < n; i++) prefix[i + 1] = prefix[i] + arr[i];
int rangeSum = prefix[r + 1] - prefix[l]; // sum of arr[l..r]

// "subarray summing to k" via map of prefix-sum frequencies
Map<Integer,Integer> seen = new HashMap<>();
seen.put(0, 1);
int running = 0;
for (int x : arr) {
    running += x;
    // running - k was a previous prefix => a subarray sums to k
}
```

### Subarray Sum Equals K
**Category:** ⭐ Tier 1 · Core
**Pattern:** Prefix sum + hash map  **Time:** O(n)  **Space:** O(n)
**Approach:** A subarray `(i,j]` sums to `k` iff `prefix[j] - prefix[i] == k`. Scan left to right keeping a map of how many times each prefix sum has occurred; at each step add the count of `running - k` previously seen. Seed the map with `{0:1}` to count subarrays starting at index 0.

```java
public int subarraySum(int[] nums, int k) {
    Map<Integer, Integer> seen = new HashMap<>();
    seen.put(0, 1);
    int running = 0, count = 0;
    for (int x : nums) {
        running += x;
        count += seen.getOrDefault(running - k, 0);
        seen.merge(running, 1, Integer::sum);
    }
    return count;
}
```

### Product of Array Except Self
**Category:** ⭐ Tier 1 · Core
**Pattern:** Prefix / suffix products  **Time:** O(n)  **Space:** O(1) (excluding output)
**Approach:** First pass fills each slot with the product of everything to its left. Second pass walks from the right multiplying in a running suffix product. No division is used, so zeros are handled naturally.

```java
public int[] productExceptSelf(int[] nums) {
    int n = nums.length;
    int[] res = new int[n];
    res[0] = 1;
    for (int i = 1; i < n; i++) res[i] = res[i - 1] * nums[i - 1]; // prefix
    int suffix = 1;
    for (int i = n - 1; i >= 0; i--) {
        res[i] *= suffix;
        suffix *= nums[i];
    }
    return res;
}
```

### Find Pivot Index
**Category:** Tier 3 · Reference
**Pattern:** Prefix sum  **Time:** O(n)  **Space:** O(1)
**Approach:** The pivot has equal left and right sums. Compute the total, then sweep left to right maintaining `leftSum`; the right sum is `total - leftSum - nums[i]`. Return the first index where these match.

```java
public int pivotIndex(int[] nums) {
    int total = 0;
    for (int x : nums) total += x;
    int leftSum = 0;
    for (int i = 0; i < nums.length; i++) {
        if (leftSum == total - leftSum - nums[i]) return i;
        leftSum += nums[i];
    }
    return -1;
}
```

### Continuous Subarray Sum
**Category:** Tier 3 · Reference
**Pattern:** Prefix sum modulo + hash map  **Time:** O(n)  **Space:** O(min(n, k))
**Approach:** A subarray sum is a multiple of `k` iff two prefix sums share the same remainder mod `k`. Store the earliest index for each remainder; if the same remainder reappears at least two indices later, we have a valid subarray of length ≥ 2. Seed remainder `0` at index `-1`.

```java
public boolean checkSubarraySum(int[] nums, int k) {
    Map<Integer, Integer> firstIndex = new HashMap<>();
    firstIndex.put(0, -1);
    int running = 0;
    for (int i = 0; i < nums.length; i++) {
        running += nums[i];
        int rem = k == 0 ? running : running % k;
        if (firstIndex.containsKey(rem)) {
            if (i - firstIndex.get(rem) >= 2) return true;
        } else {
            firstIndex.put(rem, i);
        }
    }
    return false;
}
```

### Range Sum Query — Immutable
**Category:** Tier 3 · Reference
**Pattern:** Prefix sum (precompute once)  **Time:** O(n) build, O(1) query  **Space:** O(n)
**Approach:** Precompute a prefix array where `prefix[i]` is the sum of the first `i` elements. Any `sumRange(l, r)` is then `prefix[r+1] - prefix[l]`, answered in constant time regardless of how many queries arrive.

```java
class NumArray {
    private final int[] prefix;
    public NumArray(int[] nums) {
        prefix = new int[nums.length + 1];
        for (int i = 0; i < nums.length; i++) prefix[i + 1] = prefix[i] + nums[i];
    }
    public int sumRange(int left, int right) {
        return prefix[right + 1] - prefix[left];
    }
}
```

### Difference Array (Range Updates)
**Category:** Tier 3 · Reference
**Pattern:** Difference array (inverse of prefix sum)  **Time:** O(n + q) for q updates  **Space:** O(n)
**Approach:** To apply many `add val to [l, r]` updates cheaply, record only the boundaries: `diff[l] += val` and `diff[r+1] -= val`. After all updates, a single prefix-sum pass over `diff` reconstructs the final array. Each range update is O(1) instead of O(r-l).

```java
public int[] applyRangeUpdates(int n, int[][] updates) {
    int[] diff = new int[n + 1];
    for (int[] u : updates) {           // u = {l, r, val}
        diff[u[0]] += u[2];
        diff[u[1] + 1] -= u[2];
    }
    int[] res = new int[n];
    int running = 0;
    for (int i = 0; i < n; i++) {
        running += diff[i];
        res[i] = running;
    }
    return res;
}
```

---

## 6. Kadane's Algorithm

**When to use / how to recognize it:** You want the best contiguous subarray under a running objective (max sum, max product). Carry the best result *ending at the current index*; at each step decide whether to extend the previous run or restart from the current element. O(n), O(1).

**Template:**
```java
int curr = arr[0], best = arr[0];
for (int i = 1; i < arr.length; i++) {
    curr = Math.max(arr[i], curr + arr[i]); // extend or restart
    best = Math.max(best, curr);
}
```

### Maximum Subarray
**Category:** ⭐ Tier 1 · Core
**Pattern:** Kadane  **Time:** O(n)  **Space:** O(1)
**Approach:** `curr` holds the maximum subarray sum ending at the current index: either start fresh at `nums[i]` or extend the previous run. A negative running sum can only hurt, so we drop it by restarting. Track the global best across all positions.

```java
public int maxSubArray(int[] nums) {
    int curr = nums[0], best = nums[0];
    for (int i = 1; i < nums.length; i++) {
        curr = Math.max(nums[i], curr + nums[i]);
        best = Math.max(best, curr);
    }
    return best;
}
```

### Maximum Product Subarray
**Category:** Tier 2 · Reinforce
**Pattern:** Kadane variant (track min and max)  **Time:** O(n)  **Space:** O(1)
**Approach:** Products flip sign, so a large negative can become the best after multiplying by another negative. Track both the running max and running min ending here; on a negative element, swap them before updating. The answer is the largest running max seen.

```java
public int maxProduct(int[] nums) {
    int maxEnding = nums[0], minEnding = nums[0], best = nums[0];
    for (int i = 1; i < nums.length; i++) {
        if (nums[i] < 0) {
            int t = maxEnding; maxEnding = minEnding; minEnding = t;
        }
        maxEnding = Math.max(nums[i], maxEnding * nums[i]);
        minEnding = Math.min(nums[i], minEnding * nums[i]);
        best = Math.max(best, maxEnding);
    }
    return best;
}
```

---

## 7. Cyclic Sort

**When to use / how to recognize it:** The array holds `n` numbers drawn from a contiguous range like `[0, n]` or `[1, n]`, and you must find missing/duplicate/misplaced values in O(n) time, O(1) space. The trick: each value `v` has a natural home index (`v` or `v-1`); repeatedly swap values to their homes, then scan for slots that don't match.

**Template:**
```java
int i = 0;
while (i < nums.length) {
    int home = nums[i] - 1;            // target index for nums[i] (1..n)
    if (nums[i] > 0 && nums[i] <= nums.length && nums[i] != nums[home]) {
        int t = nums[i]; nums[i] = nums[home]; nums[home] = t; // swap home
    } else {
        i++;
    }
}
// now scan: any index where nums[i] != i+1 is anomalous
```

### Missing Number
**Category:** ⭐ Tier 1 · Core
**Pattern:** Cyclic sort (range [0, n])  **Time:** O(n)  **Space:** O(1)
**Approach:** Values are `0..n` with one missing, so value `v` belongs at index `v`. Place each in-range value at its home index. After sorting, the first index whose value doesn't equal the index is the missing number; if all match, the missing one is `n`.

```java
public int missingNumber(int[] nums) {
    int n = nums.length, i = 0;
    while (i < n) {
        if (nums[i] < n && nums[i] != i) {
            int t = nums[i]; nums[i] = nums[nums[i]]; nums[t] = t;
        } else {
            i++;
        }
    }
    for (int j = 0; j < n; j++) if (nums[j] != j) return j;
    return n;
}
```

**Alternative (XOR / sum, no mutation):** XOR all indices `0..n` with all values; pairs cancel, leaving the missing number. O(n) time, O(1) space, non-destructive.

```java
public int missingNumberXor(int[] nums) {
    int x = nums.length;
    for (int i = 0; i < nums.length; i++) x ^= i ^ nums[i];
    return x;
}
```

### Find All Duplicates in an Array
**Category:** Tier 3 · Reference
**Pattern:** Cyclic sort (range [1, n], each appears once or twice)  **Time:** O(n)  **Space:** O(1)
**Approach:** Value `v` belongs at index `v-1`. Cyclic-sort everything home; afterward any index `i` whose value isn't `i+1` is holding a duplicate (its true home was already occupied by the other copy). Collect those values.

```java
public List<Integer> findDuplicates(int[] nums) {
    int i = 0;
    while (i < nums.length) {
        int home = nums[i] - 1;
        if (nums[i] != nums[home]) {
            int t = nums[i]; nums[i] = nums[home]; nums[home] = t;
        } else {
            i++;
        }
    }
    List<Integer> res = new ArrayList<>();
    for (int j = 0; j < nums.length; j++) {
        if (nums[j] != j + 1) res.add(nums[j]);
    }
    return res;
}
```

**Alternative (sign marking, no swaps):** Treat the value at index `|v|-1` as a visit flag: negate it on first visit; if it's already negative, `v` is a duplicate. Restores nothing but is concise and O(n)/O(1).

```java
public List<Integer> findDuplicatesSign(int[] nums) {
    List<Integer> res = new ArrayList<>();
    for (int x : nums) {
        int idx = Math.abs(x) - 1;
        if (nums[idx] < 0) res.add(idx + 1);
        else nums[idx] = -nums[idx];
    }
    return res;
}
```

### First Missing Positive
**Category:** Tier 2 · Reinforce
**Pattern:** Cyclic sort (range [1, n])  **Time:** O(n)  **Space:** O(1)
**Approach:** Only values in `1..n` can be the answer; place each such value at index `v-1`, ignoring out-of-range and duplicates. After placement, the first index `i` where `nums[i] != i+1` gives the missing positive `i+1`; if all are in place, the answer is `n+1`.

```java
public int firstMissingPositive(int[] nums) {
    int n = nums.length, i = 0;
    while (i < n) {
        int home = nums[i] - 1;
        if (nums[i] > 0 && nums[i] <= n && nums[i] != nums[home]) {
            int t = nums[i]; nums[i] = nums[home]; nums[home] = t;
        } else {
            i++;
        }
    }
    for (int j = 0; j < n; j++) if (nums[j] != j + 1) return j + 1;
    return n + 1;
}
```

### Find the Duplicate Number
**Category:** Tier 3 · Reference
**Pattern:** Floyd's cycle detection (read-only)  **Time:** O(n)  **Space:** O(1)
**Approach:** With `n+1` values in `1..n`, treating `nums[i]` as a "next" pointer creates a linked list with a cycle whose entrance is the duplicate. Phase 1 finds a meeting point with fast/slow pointers; phase 2 walks one pointer from the start and one from the meeting point at equal speed — they meet at the cycle entrance, the duplicate. Does not modify the array.

```java
public int findDuplicate(int[] nums) {
    int slow = nums[0], fast = nums[0];
    do {
        slow = nums[slow];
        fast = nums[nums[fast]];
    } while (slow != fast);
    slow = nums[0];
    while (slow != fast) {
        slow = nums[slow];
        fast = nums[fast];
    }
    return slow;
}
```

**Alternative (cyclic sort, mutating):** If mutation is allowed, swap values home as in the templates; the first value found already sitting at an occupied home is the duplicate. O(n)/O(1) but destroys the input.
