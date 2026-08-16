# 04 · Binary Search & Backtracking

Templates and worked problems for binary search (sorted, on-answer, rotated, 2D), recursion, and backtracking.

---

## Canonical Binary Search Templates

Always prefer `lo + (hi - lo) / 2` over `(lo + hi) / 2` to avoid integer overflow.

### lower_bound — first index where `a[i] >= target`

<!-- Problem Statement not automatically found -->

**Category:** 🧩 Template
Returns `n` if no such index. Half-open interval `[lo, hi)`.


```java
static int lowerBound(int[] a, int target) {
    int lo = 0, hi = a.length; // hi is exclusive, representing the first out-of-bounds index
    while (lo < hi) { // Continue searching while the search space is valid
        int mid = lo + (hi - lo) / 2; // Calculate mid safely to avoid integer overflow
        if (a[mid] < target) lo = mid + 1; // Target must be to the right of mid, update lower bound
        else hi = mid; // Target could be at mid or to the left, update upper bound (exclusive)
    }
    return lo; // Returns the first index where a[i] >= target
}
```

### upper_bound — first index where `a[i] > target`

<!-- Problem Statement not automatically found -->

**Category:** 🧩 Template
Returns `n` if no such index.


```java
static int upperBound(int[] a, int target) {
    int lo = 0, hi = a.length; // hi is exclusive, search range [0, n)
    while (lo < hi) { // Search space is valid as long as lo < hi
        int mid = lo + (hi - lo) / 2; // Midpoint calculation avoiding overflow
        if (a[mid] <= target) lo = mid + 1; // We want strictly greater, so if <= target, target is to the right
        else hi = mid; // a[mid] > target, so mid is a candidate, search left half
    }
    return lo; // Returns the first index where a[i] > target
}
```

### Binary Search on Answer

<!-- Problem Statement not automatically found -->

**Category:** 🧩 Template
When the answer is a number in a monotonic range: `feasible(x)` is false for small x then true for all larger x (or vice versa). Search for the boundary.


```java
// Find smallest x in [lo, hi] with feasible(x) == true.
static int searchAnswer(int lo, int hi) {
    while (lo < hi) { // Continue while range is not empty
        int mid = lo + (hi - lo) / 2; // Safe mid calculation
        if (feasible(mid)) hi = mid;   // mid works, try to find a smaller feasible value
        else lo = mid + 1;             // mid is too small, target must be strictly larger
    }
    return lo; // Smallest feasible value found
}
```

---

# Binary Search

**When to use:** The array is sorted (or has some monotonic structure you can exploit), and you need O(log n) lookup, boundary, or rotation-pivot logic.

### Binary Search (classic)

<!-- Problem Statement not automatically found -->

**Category:** ⭐ Tier 1 · Core
**Pattern:** Binary Search  **Time:** O(log n)  **Space:** O(1)
**Approach:** Maintain an inclusive `[lo, hi]` window. Compare the midpoint to the target and discard the half that cannot contain it. Stop when the window is empty.


```java
class Solution {
    public int search(int[] nums, int target) {
        int lo = 0, hi = nums.length - 1; // Inclusive search bounds [lo, hi]
        while (lo <= hi) { // Loop until the bounds cross each other
            int mid = lo + (hi - lo) / 2; // Find midpoint safely
            if (nums[mid] == target) return mid; // Target found exactly at mid
            else if (nums[mid] < target) lo = mid + 1; // Target is larger, discard left half
            else hi = mid - 1; // Target is smaller, discard right half
        }
        return -1; // Target was not found in the array
    }
}
```

### Search Insert Position

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Search Insert Position](https://leetcode.com/problems/search-insert-position/)


Given a sorted array of distinct integers and a target value, return the index if the target is found. If not, return the index where it would be if it were inserted in order.

You must write an algorithm with `O(log n)` runtime complexity.

 

<strong class="example">Example 1:</strong>

```text

**Input:** nums = [1,3,5,6], target = 5
**Output:** 2

```

<strong class="example">Example 2:</strong>

```text

**Input:** nums = [1,3,5,6], target = 2
**Output:** 1

```

<strong class="example">Example 3:</strong>

```text

**Input:** nums = [1,3,5,6], target = 7
**Output:** 4

```

 

**Constraints:**

	- `1 <= nums.length <= 10<sup>4</sup>`

	- `-10<sup>4</sup> <= nums[i] <= 10<sup>4</sup>`

	- `nums` contains **distinct** values sorted in **ascending** order.

	- `-10<sup>4</sup> <= target <= 10<sup>4</sup>`

</details>

**Category:** Tier 3 · Reference
**Pattern:** lower_bound  **Time:** O(log n)  **Space:** O(1)
**Approach:** The insert position is exactly the first index whose value is `>= target`, i.e. `lower_bound`. If the target is larger than everything, the answer is `n`, which the half-open template returns naturally.


```java
class Solution {
    public int searchInsert(int[] nums, int target) {
        int lo = 0, hi = nums.length; // exclusive upper bound for possible insertion at the end
        while (lo < hi) { // Search space [lo, hi)
            int mid = lo + (hi - lo) / 2; // Avoid overflow calculating mid
            if (nums[mid] < target) lo = mid + 1; // Target is strictly greater, must be inserted after mid
            else hi = mid; // Target is <= nums[mid], insertion point is at mid or earlier
        }
        return lo; // Represents the exact insertion index
    }
}
```

### Find First and Last Position of Element

<!-- Problem Statement not automatically found -->

**Category:** ⭐ Tier 1 · Core
**Pattern:** lower_bound + upper_bound  **Time:** O(log n)  **Space:** O(1)
**Approach:** The first occurrence is `lower_bound(target)`; the last is `upper_bound(target) - 1`. If `lower_bound` lands out of range or on a different value, the target is absent and we return `[-1, -1]`.


```java
class Solution {
    public int[] searchRange(int[] nums, int target) {
        int first = lowerBound(nums, target); // Find the first occurrence (>= target)
        // If lowerBound returns an index out of bounds, or value is not target, it doesn't exist
        if (first == nums.length || nums[first] != target)
            return new int[]{-1, -1}; // Target not found
        int last = upperBound(nums, target) - 1; // Find first element > target, then step back one index
        return new int[]{first, last}; // Return the inclusive range [first, last]
    }

    private int lowerBound(int[] a, int t) {
        int lo = 0, hi = a.length; // Half-open interval
        while (lo < hi) { // Narrow down the search space
            int mid = lo + (hi - lo) / 2; // Compute mid safely
            if (a[mid] < t) lo = mid + 1; else hi = mid; // If strictly less, search right. Else, search left (inclusive of mid)
        }
        return lo; // Index of first element >= t
    }

    private int upperBound(int[] a, int t) {
        int lo = 0, hi = a.length; // Half-open interval
        while (lo < hi) { // Narrow down search space
            int mid = lo + (hi - lo) / 2; // Compute mid safely
            if (a[mid] <= t) lo = mid + 1; else hi = mid; // If <= t, we must look further right for > t. Else look left
        }
        return lo; // Index of first element > t
    }
}
```

### Search in Rotated Sorted Array

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Search in Rotated Sorted Array](https://leetcode.com/problems/search-in-rotated-sorted-array/)


There is an integer array `nums` sorted in ascending order (with **distinct** values).

Prior to being passed to your function, `nums` is **possibly left rotated** at an unknown index `k` (`1 <= k < nums.length`) such that the resulting array is `[nums[k], nums[k+1], ..., nums[n-1], nums[0], nums[1], ..., nums[k-1]]` (**0-indexed**). For example, `[0,1,2,4,5,6,7]` might be left rotated by `3` indices and become `[4,5,6,7,0,1,2]`.

Given the array `nums` **after** the possible rotation and an integer `target`, return *the index of *`target`* if it is in *`nums`*, or *`-1`* if it is not in *`nums`.

You must write an algorithm with `O(log n)` runtime complexity.

 

<strong class="example">Example 1:</strong>

```text
**Input:** nums = [4,5,6,7,0,1,2], target = 0
**Output:** 4

```

<strong class="example">Example 2:</strong>

```text
**Input:** nums = [4,5,6,7,0,1,2], target = 3
**Output:** -1

```

<strong class="example">Example 3:</strong>

```text
**Input:** nums = [1], target = 0
**Output:** -1

```

 

**Constraints:**

	- `1 <= nums.length <= 5000`

	- `-10<sup>4</sup> <= nums[i] <= 10<sup>4</sup>`

	- All values of `nums` are **unique**.

	- `nums` is an ascending array that is possibly rotated.

	- `-10<sup>4</sup> <= target <= 10<sup>4</sup>`

</details>

**Category:** ⭐ Tier 1 · Core
**Pattern:** Modified Binary Search  **Time:** O(log n)  **Space:** O(1)
**Approach:** At each step one half `[lo, mid]` or `[mid, hi]` is guaranteed sorted. Detect the sorted half by comparing `nums[lo]` with `nums[mid]`, then check whether the target falls inside that sorted half's range; recurse into whichever half could contain it.


```java
class Solution {
    public int search(int[] nums, int target) {
        int lo = 0, hi = nums.length - 1; // Range encompasses the whole array
        while (lo <= hi) { // Continue while the search space is valid
            int mid = lo + (hi - lo) / 2; // Midpoint to avoid overflow
            if (nums[mid] == target) return mid; // Found the target exactly
            if (nums[lo] <= nums[mid]) {            // Left half is strictly sorted
                if (nums[lo] <= target && target < nums[mid]) hi = mid - 1; // Target is in the sorted left half
                else lo = mid + 1; // Target must be in the right half
            } else {                                // Right half is strictly sorted
                if (nums[mid] < target && target <= nums[hi]) lo = mid + 1; // Target is in the sorted right half
                else hi = mid - 1; // Target must be in the left half
            }
        }
        return -1; // Target not found
    }
}
```

### Find Minimum in Rotated Sorted Array

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Find Minimum in Rotated Sorted Array](https://leetcode.com/problems/find-minimum-in-rotated-sorted-array/)


Suppose an array of length `n` sorted in ascending order is **rotated** between `1` and `n` times. For example, the array `nums = [0,1,2,4,5,6,7]` might become:

	- `[4,5,6,7,0,1,2]` if it was rotated `4` times.

	- `[0,1,2,4,5,6,7]` if it was rotated `7` times.

Notice that **rotating** an array `[a[0], a[1], a[2], ..., a[n-1]]` 1 time results in the array `[a[n-1], a[0], a[1], a[2], ..., a[n-2]]`.

Given the sorted rotated array `nums` of **unique** elements, return *the minimum element of this array*.

You must write an algorithm that runs in `O(log n) time`.

 

<strong class="example">Example 1:</strong>

```text

**Input:** nums = [3,4,5,1,2]
**Output:** 1
**Explanation:** The original array was [1,2,3,4,5] rotated 3 times.

```

<strong class="example">Example 2:</strong>

```text

**Input:** nums = [4,5,6,7,0,1,2]
**Output:** 0
**Explanation:** The original array was [0,1,2,4,5,6,7] and it was rotated 4 times.

```

<strong class="example">Example 3:</strong>

```text

**Input:** nums = [11,13,15,17]
**Output:** 11
**Explanation:** The original array was [11,13,15,17] and it was rotated 4 times. 

```

 

**Constraints:**

	- `n == nums.length`

	- `1 <= n <= 5000`

	- `-5000 <= nums[i] <= 5000`

	- All the integers of `nums` are **unique**.

	- `nums` is sorted and rotated between `1` and `n` times.

</details>

**Category:** Tier 2 · Reinforce
**Pattern:** Binary Search on pivot  **Time:** O(log n)  **Space:** O(1)
**Approach:** The minimum is the single "inflection" point. Compare `nums[mid]` to `nums[hi]`: if `nums[mid] > nums[hi]` the minimum lies strictly to the right of mid; otherwise it is at mid or to its left. Converge until `lo == hi`.


```java
class Solution {
    public int findMin(int[] nums) {
        int lo = 0, hi = nums.length - 1; // Range [0, n-1]
        while (lo < hi) { // Terminate when lo == hi, pointing to the minimum
            int mid = lo + (hi - lo) / 2; // Avoid overflow
            if (nums[mid] > nums[hi]) lo = mid + 1; // Minimum must be to the right of mid because the right half is unsorted/wrapped
            else hi = mid; // Right half is sorted, minimum is at mid or to its left
        }
        return nums[lo]; // lo and hi converge at the minimum
    }
}
```
**Alternative:** With duplicates (LC 154) add `else hi--` when `nums[mid] == nums[hi]`, degrading worst case to O(n).

### Search a 2D Matrix

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Search a 2D Matrix](https://leetcode.com/problems/search-a-2d-matrix/)


You are given an `m x n` integer matrix `matrix` with the following two properties:

	- Each row is sorted in non-decreasing order.

	- The first integer of each row is greater than the last integer of the previous row.

Given an integer `target`, return `true` *if* `target` *is in* `matrix` *or* `false` *otherwise*.

You must write a solution in `O(log(m * n))` time complexity.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2020/10/05/mat.jpg" style="width: 322px; height: 242px;" />

```text

**Input:** matrix = [[1,3,5,7],[10,11,16,20],[23,30,34,60]], target = 3
**Output:** true

```

<strong class="example">Example 2:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2020/10/05/mat2.jpg" style="width: 322px; height: 242px;" />

```text

**Input:** matrix = [[1,3,5,7],[10,11,16,20],[23,30,34,60]], target = 13
**Output:** false

```

 

**Constraints:**

	- `m == matrix.length`

	- `n == matrix[i].length`

	- `1 <= m, n <= 100`

	- `-10<sup>4</sup> <= matrix[i][j], target <= 10<sup>4</sup>`

</details>

**Category:** Tier 2 · Reinforce
**Pattern:** Binary Search on flattened index  **Time:** O(log(m·n))  **Space:** O(1)
**Approach:** Rows are sorted and each row's first element exceeds the previous row's last, so the matrix is one sorted sequence. Binary search over `[0, m*n)` and map a flat index `idx` to `(idx / cols, idx % cols)`.


```java
class Solution {
    public boolean searchMatrix(int[][] matrix, int target) {
        int m = matrix.length, n = matrix[0].length; // Matrix dimensions
        int lo = 0, hi = m * n - 1; // Treat the 2D matrix as a 1D array of size m*n
        while (lo <= hi) { // Standard binary search loop
            int mid = lo + (hi - lo) / 2; // Find the 1D midpoint
            int val = matrix[mid / n][mid % n]; // Map 1D mid back to 2D coordinates
            if (val == target) return true; // Found the target
            else if (val < target) lo = mid + 1; // Look in the right half
            else hi = mid - 1; // Look in the left half
        }
        return false; // Target not found in the matrix
    }
}
```

### Search a 2D Matrix II

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Search a 2D Matrix II](https://leetcode.com/problems/search-a-2d-matrix-ii/)


Write an efficient algorithm that searches for a value `target` in an `m x n` integer matrix `matrix`. This matrix has the following properties:

	- Integers in each row are sorted in ascending from left to right.

	- Integers in each column are sorted in ascending from top to bottom.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2020/11/24/searchgrid2.jpg" style="width: 300px; height: 300px;" />

```text

**Input:** matrix = [[1,4,7,11,15],[2,5,8,12,19],[3,6,9,16,22],[10,13,14,17,24],[18,21,23,26,30]], target = 5
**Output:** true

```

<strong class="example">Example 2:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2020/11/24/searchgrid.jpg" style="width: 300px; height: 300px;" />

```text

**Input:** matrix = [[1,4,7,11,15],[2,5,8,12,19],[3,6,9,16,22],[10,13,14,17,24],[18,21,23,26,30]], target = 20
**Output:** false

```

 

**Constraints:**

	- `m == matrix.length`

	- `n == matrix[i].length`

	- `1 <= n, m <= 300`

	- `-10<sup>9</sup> <= matrix[i][j] <= 10<sup>9</sup>`

	- All the integers in each row are **sorted** in ascending order.

	- All the integers in each column are **sorted** in ascending order.

	- `-10<sup>9</sup> <= target <= 10<sup>9</sup>`

</details>

**Category:** Tier 3 · Reference
**Pattern:** Staircase search  **Time:** O(m + n)  **Space:** O(1)
**Approach:** Rows and columns are each sorted but rows do not chain into one sequence. Start at the top-right corner: if the value is larger than the target move left (eliminate a column), if smaller move down (eliminate a row). Each step removes one row or column.


```java
class Solution {
    public boolean searchMatrix(int[][] matrix, int target) {
        int r = 0, c = matrix[0].length - 1; // Start from top-right corner
        while (r < matrix.length && c >= 0) { // Continue as long as we are within matrix bounds
            int val = matrix[r][c]; // Get current value
            if (val == target) return true; // Target found
            else if (val > target) c--; // Current value is too large, eliminate current column (move left)
            else r++; // Current value is too small, eliminate current row (move down)
        }
        return false; // Traversed out of bounds without finding target
    }
}
```

### Median of Two Sorted Arrays

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Median of Two Sorted Arrays](https://leetcode.com/problems/median-of-two-sorted-arrays/)


Given two sorted arrays `nums1` and `nums2` of size `m` and `n` respectively, return **the median** of the two sorted arrays.

The overall run time complexity should be `O(log (m+n))`.

 

<strong class="example">Example 1:</strong>

```text

**Input:** nums1 = [1,3], nums2 = [2]
**Output:** 2.00000
**Explanation:** merged array = [1,2,3] and median is 2.

```

<strong class="example">Example 2:</strong>

```text

**Input:** nums1 = [1,2], nums2 = [3,4]
**Output:** 2.50000
**Explanation:** merged array = [1,2,3,4] and median is (2 + 3) / 2 = 2.5.

```

 

**Constraints:**

	- `nums1.length == m`

	- `nums2.length == n`

	- `0 <= m <= 1000`

	- `0 <= n <= 1000`

	- `1 <= m + n <= 2000`

	- `-10<sup>6</sup> <= nums1[i], nums2[i] <= 10<sup>6</sup>`

</details>

**Category:** Tier 2 · Reinforce
**Pattern:** Binary Search on partition  **Time:** O(log(min(m, n)))  **Space:** O(1)
**Approach:** Binary search a cut in the smaller array; the cut in the larger array is forced so the left side holds exactly half the elements. A valid partition satisfies `maxLeftA <= minRightB` and `maxLeftB <= minRightA`. From those four boundary values the median follows directly.


```java
class Solution {
    public double findMedianSortedArrays(int[] A, int[] B) {
        if (A.length > B.length) { int[] t = A; A = B; B = t; } // Ensure A is the smaller array to minimize binary search range
        int m = A.length, n = B.length, half = (m + n + 1) / 2; // Calculate half length for partitioning
        int lo = 0, hi = m; // Binary search range on array A
        while (lo <= hi) { // Binary search for the correct partition
            int i = lo + (hi - lo) / 2; // Cut in A
            int j = half - i;           // Cut in B is complementary to maintain equal left and right sizes
            int maxLeftA  = (i == 0) ? Integer.MIN_VALUE : A[i - 1]; // Max element in left of A
            int minRightA = (i == m) ? Integer.MAX_VALUE : A[i];     // Min element in right of A
            int maxLeftB  = (j == 0) ? Integer.MIN_VALUE : B[j - 1]; // Max element in left of B
            int minRightB = (j == n) ? Integer.MAX_VALUE : B[j];     // Min element in right of B
            if (maxLeftA <= minRightB && maxLeftB <= minRightA) { // Partition is correct!
                if (((m + n) & 1) == 1) // Total length is odd
                    return Math.max(maxLeftA, maxLeftB); // Median is the max of the left partition
                return (Math.max(maxLeftA, maxLeftB) // Total length is even
                      + Math.min(minRightA, minRightB)) / 2.0; // Average of max left and min right
            } else if (maxLeftA > minRightB) { // A's left part is too big
                hi = i - 1; // Move partition in A to the left
            } else { // B's left part is too big
                lo = i + 1; // Move partition in A to the right
            }
        }
        throw new IllegalArgumentException("Input arrays not sorted"); // Given constraints, should not be reached
    }
}
```

---

# Binary Search on Answer

**When to use:** You are not searching an array but a numeric answer (speed, capacity, size) where a predicate `feasible(x)` is monotonic. Search the value space for the boundary between infeasible and feasible.

### Koko Eating Bananas

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Koko Eating Bananas](https://leetcode.com/problems/koko-eating-bananas/)


Koko loves to eat bananas. There are `n` piles of bananas, the `i<sup>th</sup>` pile has `piles[i]` bananas. The guards have gone and will come back in `h` hours.

Koko can decide her bananas-per-hour eating speed of `k`. Each hour, she chooses some pile of bananas and eats `k` bananas from that pile. If the pile has less than `k` bananas, she eats all of them instead and will not eat any more bananas during this hour.

Koko likes to eat slowly but still wants to finish eating all the bananas before the guards return.

Return *the minimum integer* `k` *such that she can eat all the bananas within* `h` *hours*.

 

<strong class="example">Example 1:</strong>

```text

**Input:** piles = [3,6,7,11], h = 8
**Output:** 4

```

<strong class="example">Example 2:</strong>

```text

**Input:** piles = [30,11,23,4,20], h = 5
**Output:** 30

```

<strong class="example">Example 3:</strong>

```text

**Input:** piles = [30,11,23,4,20], h = 6
**Output:** 23

```

 

**Constraints:**

	- `1 <= piles.length <= 10<sup>4</sup>`

	- `piles.length <= h <= 10<sup>9</sup>`

	- `1 <= piles[i] <= 10<sup>9</sup>`

</details>

**Category:** ⭐ Tier 1 · Core
**Pattern:** Binary Search on answer  **Time:** O(n · log(max pile))  **Space:** O(1)
**Approach:** Eating speed is monotonic: a faster speed never needs more hours. Search speeds in `[1, max(piles)]` for the smallest `k` where total hours `sum(ceil(pile / k))` is `<= h`.


```java
class Solution {
    public int minEatingSpeed(int[] piles, int h) {
        int lo = 1, hi = 0; // Speeds range from 1 to max(piles)
        for (int p : piles) hi = Math.max(hi, p); // Find the maximum pile size for the upper bound
        while (lo < hi) { // Binary search for the optimal speed
            int mid = lo + (hi - lo) / 2; // Try middle speed
            if (hoursNeeded(piles, mid) <= h) hi = mid; // Can eat within h hours, try a slower speed
            else lo = mid + 1; // Cannot eat within h hours, must eat faster
        }
        return lo; // Minimum valid eating speed
    }

    private long hoursNeeded(int[] piles, int k) {
        long hours = 0; // Track total hours needed with speed k
        for (int p : piles) hours += (p + k - 1) / k; // ceil division: mathematically equivalent to ceil(p / k)
        return hours; // Return total hours
    }
}
```

### Capacity to Ship Packages Within D Days

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Capacity to Ship Packages Within D Days](https://leetcode.com/problems/capacity-to-ship-packages-within-d-days/)


A conveyor belt has packages that must be shipped from one port to another within `days` days.

The `i<sup>th</sup>` package on the conveyor belt has a weight of `weights[i]`. Each day, we load the ship with packages on the conveyor belt (in the order given by `weights`). We may not load more weight than the maximum weight capacity of the ship.

Return the least weight capacity of the ship that will result in all the packages on the conveyor belt being shipped within `days` days.

 

<strong class="example">Example 1:</strong>

```text

**Input:** weights = [1,2,3,4,5,6,7,8,9,10], days = 5
**Output:** 15
**Explanation:** A ship capacity of 15 is the minimum to ship all the packages in 5 days like this:
1st day: 1, 2, 3, 4, 5
2nd day: 6, 7
3rd day: 8
4th day: 9
5th day: 10

Note that the cargo must be shipped in the order given, so using a ship of capacity 14 and splitting the packages into parts like (2, 3, 4, 5), (1, 6, 7), (8), (9), (10) is not allowed.

```

<strong class="example">Example 2:</strong>

```text

**Input:** weights = [3,2,2,4,1,4], days = 3
**Output:** 6
**Explanation:** A ship capacity of 6 is the minimum to ship all the packages in 3 days like this:
1st day: 3, 2
2nd day: 2, 4
3rd day: 1, 4

```

<strong class="example">Example 3:</strong>

```text

**Input:** weights = [1,2,3,1,1], days = 4
**Output:** 3
**Explanation:**
1st day: 1
2nd day: 2
3rd day: 3
4th day: 1, 1

```

 

**Constraints:**

	- `1 <= days <= weights.length <= 5 * 10<sup>4</sup>`

	- `1 <= weights[i] <= 500`

</details>

**Category:** Tier 2 · Reinforce
**Pattern:** Binary Search on answer  **Time:** O(n · log(sum))  **Space:** O(1)
**Approach:** A larger ship capacity never needs more days, so days-needed is monotonic in capacity. The capacity must be at least `max(weights)` (to fit the biggest package) and at most `sum(weights)`. Search that range for the smallest capacity shippable within `days`.


```java
class Solution {
    public int shipWithinDays(int[] weights, int days) {
        int lo = 0, hi = 0; // min capacity is max(weights), max capacity is sum(weights)
        for (int w : weights) { lo = Math.max(lo, w); hi += w; } // Find bounds for binary search
        while (lo < hi) { // Binary search on capacity
            int mid = lo + (hi - lo) / 2; // Midpoint capacity
            if (daysNeeded(weights, mid) <= days) hi = mid; // Capacity is sufficient, try smaller
            else lo = mid + 1; // Capacity is too small, need larger
        }
        return lo; // Smallest capacity to ship within 'days' days
    }

    private int daysNeeded(int[] weights, int cap) {
        int days = 1, load = 0; // Start with 1 day and 0 initial load
        for (int w : weights) { // Add each package
            if (load + w > cap) { days++; load = 0; } // Ship is full, start a new day
            load += w; // Load package onto the current day's ship
        }
        return days; // Total days needed for given capacity
    }
}
```

### Split Array Largest Sum

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Split Array Largest Sum](https://leetcode.com/problems/split-array-largest-sum/)


Given an integer array `nums` and an integer `k`, split `nums` into `k` non-empty subarrays such that the largest sum of any subarray is **minimized**.

Return *the minimized largest sum of the split*.

A **subarray** is a contiguous part of the array.

 

<strong class="example">Example 1:</strong>

```text

**Input:** nums = [7,2,5,10,8], k = 2
**Output:** 18
**Explanation:** There are four ways to split nums into two subarrays.
The best way is to split it into [7,2,5] and [10,8], where the largest sum among the two subarrays is only 18.

```

<strong class="example">Example 2:</strong>

```text

**Input:** nums = [1,2,3,4,5], k = 2
**Output:** 9
**Explanation:** There are four ways to split nums into two subarrays.
The best way is to split it into [1,2,3] and [4,5], where the largest sum among the two subarrays is only 9.

```

 

**Constraints:**

	- `1 <= nums.length <= 1000`

	- `0 <= nums[i] <= 10<sup>6</sup>`

	- `1 <= k <= min(50, nums.length)`

</details>

**Category:** Tier 3 · Reference
**Pattern:** Binary Search on answer  **Time:** O(n · log(sum))  **Space:** O(1)
**Approach:** Minimize the largest subarray sum over `k` contiguous splits. For a candidate max sum, greedily count how many subarrays are needed; fewer needed means the candidate is feasible. Search candidates in `[max(nums), sum(nums)]` for the smallest feasible one (identical machinery to ship-packages).


```java
class Solution {
    public int splitArray(int[] nums, int k) {
        int lo = 0, hi = 0; // Minimum possible max-sum is max(nums), maximum is sum(nums)
        for (int x : nums) { lo = Math.max(lo, x); hi += x; } // Initialize bounds
        while (lo < hi) { // Binary search for the minimized largest sum
            int mid = lo + (hi - lo) / 2; // Test a candidate max-sum
            if (partitions(nums, mid) <= k) hi = mid; // Can split into <= k parts, try a tighter sum
            else lo = mid + 1; // Need more than k parts, candidate sum is too small
        }
        return lo; // The minimized largest sum
    }

    private int partitions(int[] nums, int maxSum) {
        int count = 1, sum = 0; // Need at least 1 partition
        for (int x : nums) { // Add numbers to the current partition
            if (sum + x > maxSum) { count++; sum = 0; } // Exceeds limit, start a new partition
            sum += x; // Add to current partition
        }
        return count; // Total partitions needed
    }
}
```

### Find Peak Element

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Find Peak Element](https://leetcode.com/problems/find-peak-element/)


A peak element is an element that is strictly greater than its neighbors.

Given a **0-indexed** integer array `nums`, find a peak element, and return its index. If the array contains multiple peaks, return the index to **any of the peaks**.

You may imagine that `nums[-1] = nums[n] = -&infin;`. In other words, an element is always considered to be strictly greater than a neighbor that is outside the array.

You must write an algorithm that runs in `O(log n)` time.

 

<strong class="example">Example 1:</strong>

```text

**Input:** nums = [1,2,3,1]
**Output:** 2
**Explanation:** 3 is a peak element and your function should return the index number 2.
```

<strong class="example">Example 2:</strong>

```text

**Input:** nums = [1,2,1,3,5,6,4]
**Output:** 5
**Explanation:** Your function can return either index number 1 where the peak element is 2, or index number 5 where the peak element is 6.
```

 

**Constraints:**

	- `1 <= nums.length <= 1000`

	- `-2<sup>31</sup> <= nums[i] <= 2<sup>31</sup> - 1`

	- `nums[i] != nums[i + 1]` for all valid `i`.

</details>

**Category:** Tier 3 · Reference
**Pattern:** Binary Search on slope  **Time:** O(log n)  **Space:** O(1)
**Approach:** Any element greater than both neighbors is a peak; with `nums[-1] = nums[n] = -inf` a peak always exists. If `nums[mid] < nums[mid+1]` an ascending slope guarantees a peak to the right, so move right; otherwise a peak is at mid or to its left.


```java
class Solution {
    public int findPeakElement(int[] nums) {
        int lo = 0, hi = nums.length - 1; // Range encompasses the whole array
        while (lo < hi) { // Converge to a single peak element
            int mid = lo + (hi - lo) / 2; // Find midpoint
            if (nums[mid] < nums[mid + 1]) lo = mid + 1; // Ascending slope, a peak must exist to the right
            else hi = mid; // Descending slope (or flat), a peak must exist at mid or to the left
        }
        return lo; // Returns the index of any peak
    }
}
```

---

# Backtracking

**When to use:** You must enumerate or search combinatorial structures (subsets, permutations, partitions, board placements). Build a candidate incrementally, recurse, and undo the choice (backtrack) to explore alternatives.

### General Backtracking Template

<!-- Problem Statement not automatically found -->

**Category:** 🧩 Template


```java
void backtrack(State state, List<Solution> results) {
    if (isComplete(state)) { // Base case: the current state is a valid, complete solution
        results.add(snapshot(state)); // Add a copy of the state to the results to prevent reference mutation
        return; // Backtrack
    }
    for (Choice choice : choices(state)) { // Iterate over all possible choices from the current state
        if (!valid(state, choice)) continue; // Prune: skip invalid choices
        apply(state, choice);          // Make the choice (mutate state)
        backtrack(state, results);     // Recurse deeper with the new state
        undo(state, choice);           // Undo the choice (backtrack) to explore other branches
    }
}
```
Key levers: start index (avoid reusing earlier elements), `i > start && nums[i] == nums[i-1]` to skip duplicates on a sorted array, and a `used[]` array for permutations.

### Subsets

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Subsets](https://leetcode.com/problems/subsets/)


Given an integer array `nums` of **unique** elements, return *all possible* <span data-keyword="subset">*subsets*</span> *(the power set)*.

The solution set **must not** contain duplicate subsets. Return the solution in **any order**.

 

<strong class="example">Example 1:</strong>

```text

**Input:** nums = [1,2,3]
**Output:** [[],[1],[2],[1,2],[3],[1,3],[2,3],[1,2,3]]

```

<strong class="example">Example 2:</strong>

```text

**Input:** nums = [0]
**Output:** [[],[0]]

```

 

**Constraints:**

	- `1 <= nums.length <= 10`

	- `-10 <= nums[i] <= 10`

	- All the numbers of `nums` are **unique**.

</details>

**Category:** ⭐ Tier 1 · Core
**Pattern:** Backtracking (include/exclude)  **Time:** O(n · 2^n)  **Space:** O(n) recursion
**Approach:** Every element is either in or out of a subset. Recurse from a `start` index, recording the current path at every node of the tree (not just leaves), and advance the index so each element is considered once.


```java
class Solution {
    public List<List<Integer>> subsets(int[] nums) {
        List<List<Integer>> res = new ArrayList<>(); // To store all subsets
        backtrack(nums, 0, new ArrayList<>(), res); // Start backtracking from index 0
        return res; // Return the power set
    }

    private void backtrack(int[] nums, int start, List<Integer> path,
                           List<List<Integer>> res) {
        res.add(new ArrayList<>(path)); // Every node in the recursion tree is a valid subset
        for (int i = start; i < nums.length; i++) { // Explore further elements to add
            path.add(nums[i]); // Include nums[i]
            backtrack(nums, i + 1, path, res); // Recurse with nums[i] included
            path.remove(path.size() - 1); // Exclude nums[i] and backtrack
        }
    }
}
```

### Subsets II (dups)

<!-- Problem Statement not automatically found -->

**Category:** Tier 2 · Reinforce
**Pattern:** Backtracking + dedup  **Time:** O(n · 2^n)  **Space:** O(n)
**Approach:** Sort so equal values are adjacent. Within the same recursion level, skip any element equal to its predecessor (`i > start && nums[i] == nums[i-1]`); this prevents generating two subsets that differ only by which copy of a duplicate was chosen.


```java
class Solution {
    public List<List<Integer>> subsetsWithDup(int[] nums) {
        Arrays.sort(nums); // Sort to group duplicates together
        List<List<Integer>> res = new ArrayList<>(); // To store unique subsets
        backtrack(nums, 0, new ArrayList<>(), res); // Start backtracking
        return res;
    }

    private void backtrack(int[] nums, int start, List<Integer> path,
                           List<List<Integer>> res) {
        res.add(new ArrayList<>(path)); // Add current subset
        for (int i = start; i < nums.length; i++) { // Iterate over remaining choices
            if (i > start && nums[i] == nums[i - 1]) continue; // Skip duplicates at the same tree depth
            path.add(nums[i]); // Include the element
            backtrack(nums, i + 1, path, res); // Recurse for the next elements
            path.remove(path.size() - 1); // Backtrack
        }
    }
}
```

### Permutations

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Permutations](https://leetcode.com/problems/permutations/)


Given an array `nums` of distinct integers, return all the possible <span data-keyword="permutation-array">permutations</span>. You can return the answer in **any order**.

 

<strong class="example">Example 1:</strong>

```text
**Input:** nums = [1,2,3]
**Output:** [[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]]

```

<strong class="example">Example 2:</strong>

```text
**Input:** nums = [0,1]
**Output:** [[0,1],[1,0]]

```

<strong class="example">Example 3:</strong>

```text
**Input:** nums = [1]
**Output:** [[1]]

```

 

**Constraints:**

	- `1 <= nums.length <= 6`

	- `-10 <= nums[i] <= 10`

	- All the integers of `nums` are **unique**.

</details>

**Category:** ⭐ Tier 1 · Core
**Pattern:** Backtracking + used[]  **Time:** O(n · n!)  **Space:** O(n)
**Approach:** A permutation uses every element exactly once in some order. Track used elements with a boolean array; at each position try every unused element, recurse, then release it.


```java
class Solution {
    public List<List<Integer>> permute(int[] nums) {
        List<List<Integer>> res = new ArrayList<>(); // To store permutations
        backtrack(nums, new boolean[nums.length], new ArrayList<>(), res); // used[] tracks chosen elements
        return res;
    }

    private void backtrack(int[] nums, boolean[] used, List<Integer> path,
                           List<List<Integer>> res) {
        if (path.size() == nums.length) { // Base case: permutation is complete
            res.add(new ArrayList<>(path)); // Add a copy of the path
            return;
        }
        for (int i = 0; i < nums.length; i++) { // Iterate through all elements for the next position
            if (used[i]) continue; // Skip if already used in the current permutation
            used[i] = true; // Mark as used
            path.add(nums[i]); // Append to the current permutation path
            backtrack(nums, used, path, res); // Recurse to fill the next position
            path.remove(path.size() - 1); // Backtrack: remove from path
            used[i] = false; // Backtrack: mark as unused
        }
    }
}
```

### Permutations II (dups)

<!-- Problem Statement not automatically found -->

**Category:** Tier 2 · Reinforce
**Pattern:** Backtracking + used[] + dedup  **Time:** O(n · n!)  **Space:** O(n)
**Approach:** Sort the array, then within each level skip a duplicate value unless its identical predecessor has already been placed in this branch (`i > 0 && nums[i] == nums[i-1] && !used[i-1]`). This fixes a canonical order among equal elements so each distinct permutation is produced once.


```java
class Solution {
    public List<List<Integer>> permuteUnique(int[] nums) {
        Arrays.sort(nums); // Sort to bring duplicates together
        List<List<Integer>> res = new ArrayList<>(); // To store unique permutations
        backtrack(nums, new boolean[nums.length], new ArrayList<>(), res); // Track used indices
        return res;
    }

    private void backtrack(int[] nums, boolean[] used, List<Integer> path,
                           List<List<Integer>> res) {
        if (path.size() == nums.length) { // Base case: full permutation built
            res.add(new ArrayList<>(path)); // Add copy of the result
            return;
        }
        for (int i = 0; i < nums.length; i++) { // Try all elements
            if (used[i]) continue; // Skip already used elements in this path
            // Skip duplicates: if the previous identical element wasn't used in this branch,
            // using the current one would create a duplicate permutation at this position.
            if (i > 0 && nums[i] == nums[i - 1] && !used[i - 1]) continue;
            used[i] = true; // Choose the element
            path.add(nums[i]); // Add to permutation
            backtrack(nums, used, path, res); // Recurse
            path.remove(path.size() - 1); // Undo choice (backtrack)
            used[i] = false; // Mark as unused again
        }
    }
}
```

### Combinations

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Combinations](https://leetcode.com/problems/combinations/)


Given two integers `n` and `k`, return *all possible combinations of* `k` *numbers chosen from the range* `[1, n]`.

You may return the answer in **any order**.

 

<strong class="example">Example 1:</strong>

```text

**Input:** n = 4, k = 2
**Output:** [[1,2],[1,3],[1,4],[2,3],[2,4],[3,4]]
**Explanation:** There are 4 choose 2 = 6 total combinations.
Note that combinations are unordered, i.e., [1,2] and [2,1] are considered to be the same combination.

```

<strong class="example">Example 2:</strong>

```text

**Input:** n = 1, k = 1
**Output:** [[1]]
**Explanation:** There is 1 choose 1 = 1 total combination.

```

 

**Constraints:**

	- `1 <= n <= 20`

	- `1 <= k <= n`

</details>

**Category:** Tier 3 · Reference
**Pattern:** Backtracking with start index  **Time:** O(k · C(n, k))  **Space:** O(k)
**Approach:** Choose `k` of `n` numbers in increasing order. Recurse from a `start` index so combinations are generated in sorted order without repeats. Prune: stop early if remaining numbers cannot complete a size-`k` set.


```java
class Solution {
    public List<List<Integer>> combine(int n, int k) {
        List<List<Integer>> res = new ArrayList<>(); // To store all combinations
        backtrack(n, k, 1, new ArrayList<>(), res); // Start choosing from number 1
        return res;
    }

    private void backtrack(int n, int k, int start, List<Integer> path,
                           List<List<Integer>> res) {
        if (path.size() == k) { // Base case: combination of size k is formed
            res.add(new ArrayList<>(path)); // Add to results
            return;
        }
        // prune: need (k - path.size()) more numbers, so if remaining numbers in [i, n] are not enough, stop.
        for (int i = start; i <= n - (k - path.size()) + 1; i++) { // Iterate valid range to pick the next number
            path.add(i); // Pick number i
            backtrack(n, k, i + 1, path, res); // Recurse, next number must be strictly greater (i + 1)
            path.remove(path.size() - 1); // Backtrack
        }
    }
}
```

### Combination Sum

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Combination Sum](https://leetcode.com/problems/combination-sum/)


Given an array of **distinct** integers `candidates` and a target integer `target`, return *a list of all **unique combinations** of *`candidates`* where the chosen numbers sum to *`target`*.* You may return the combinations in **any order**.

The **same** number may be chosen from `candidates` an **unlimited number of times**. Two combinations are unique if the <span data-keyword="frequency-array">frequency</span> of at least one of the chosen numbers is different.

The test cases are generated such that the number of unique combinations that sum up to `target` is less than `150` combinations for the given input.

 

<strong class="example">Example 1:</strong>

```text

**Input:** candidates = [2,3,6,7], target = 7
**Output:** [[2,2,3],[7]]
**Explanation:**
2 and 3 are candidates, and 2 + 2 + 3 = 7. Note that 2 can be used multiple times.
7 is a candidate, and 7 = 7.
These are the only two combinations.

```

<strong class="example">Example 2:</strong>

```text

**Input:** candidates = [2,3,5], target = 8
**Output:** [[2,2,2,2],[2,3,3],[3,5]]

```

<strong class="example">Example 3:</strong>

```text

**Input:** candidates = [2], target = 1
**Output:** []

```

 

**Constraints:**

	- `1 <= candidates.length <= 30`

	- `2 <= candidates[i] <= 40`

	- All elements of `candidates` are **distinct**.

	- `1 <= target <= 40`

</details>

**Category:** ⭐ Tier 1 · Core
**Pattern:** Backtracking with reuse  **Time:** O(n^(target/min))  **Space:** O(target/min)
**Approach:** Numbers may be reused, so recurse passing `i` (not `i+1`) to allow picking the same element again. Subtract from the remaining target; prune when it goes negative and record a solution when it hits zero.


```java
class Solution {
    public List<List<Integer>> combinationSum(int[] candidates, int target) {
        List<List<Integer>> res = new ArrayList<>(); // To store the combinations
        Arrays.sort(candidates); // Sort to enable early pruning
        backtrack(candidates, target, 0, new ArrayList<>(), res); // Start from index 0
        return res;
    }

    private void backtrack(int[] c, int remain, int start, List<Integer> path,
                           List<List<Integer>> res) {
        if (remain == 0) { res.add(new ArrayList<>(path)); return; } // Target reached
        for (int i = start; i < c.length; i++) { // Try starting from 'start' to allow reuse but avoid permutations
            if (c[i] > remain) break;          // sorted: rest are larger too, prune branch
            path.add(c[i]); // Choose the candidate
            backtrack(c, remain - c[i], i, path, res); // reuse: stay at i (allow picking the same element again)
            path.remove(path.size() - 1); // Backtrack
        }
    }
}
```

### Combination Sum II

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Combination Sum II](https://leetcode.com/problems/combination-sum-ii/)


Given a collection of candidate numbers (`candidates`) and a target number (`target`), find all unique combinations in `candidates` where the candidate numbers sum to `target`.

Each number in `candidates` may only be used **once** in the combination.

**Note:** The solution set must not contain duplicate combinations.

 

<strong class="example">Example 1:</strong>

```text

**Input:** candidates = [10,1,2,7,6,1,5], target = 8
**Output:** 
[
[1,1,6],
[1,2,5],
[1,7],
[2,6]
]

```

<strong class="example">Example 2:</strong>

```text

**Input:** candidates = [2,5,2,1,2], target = 5
**Output:** 
[
[1,2,2],
[5]
]

```

 

**Constraints:**

	- `1 <= candidates.length <= 100`

	- `1 <= candidates[i] <= 50`

	- `1 <= target <= 30`

</details>

**Category:** Tier 3 · Reference
**Pattern:** Backtracking + dedup, no reuse  **Time:** O(2^n)  **Space:** O(n)
**Approach:** Each number is used at most once, and the input has duplicates. Sort, recurse with `i+1` to forbid reuse, and skip same-level duplicates (`i > start && c[i] == c[i-1]`) so equal candidates do not generate identical combinations.


```java
class Solution {
    public List<List<Integer>> combinationSum2(int[] candidates, int target) {
        List<List<Integer>> res = new ArrayList<>(); // Store the valid combinations
        Arrays.sort(candidates); // Sort to group duplicates and enable pruning
        backtrack(candidates, target, 0, new ArrayList<>(), res); // Start search
        return res;
    }

    private void backtrack(int[] c, int remain, int start, List<Integer> path,
                           List<List<Integer>> res) {
        if (remain == 0) { res.add(new ArrayList<>(path)); return; } // Found a valid combination
        for (int i = start; i < c.length; i++) { // Iterate through candidates
            if (i > start && c[i] == c[i - 1]) continue; // Skip duplicates at the same depth to ensure unique combinations
            if (c[i] > remain) break; // Prune: current candidate is too large, subsequent ones will be larger
            path.add(c[i]); // Select candidate
            backtrack(c, remain - c[i], i + 1, path, res); // no reuse: move to i + 1
            path.remove(path.size() - 1); // Backtrack
        }
    }
}
```

### Letter Combinations of a Phone Number

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Letter Combinations of a Phone Number](https://leetcode.com/problems/letter-combinations-of-a-phone-number/)


Given a string containing digits from `2-9` inclusive, return all possible letter combinations that the number could represent. Return the answer in **any order**.

A mapping of digits to letters (just like on the telephone buttons) is given below. Note that 1 does not map to any letters.
<img alt="" src="https://assets.leetcode.com/uploads/2022/03/15/1200px-telephone-keypad2svg.png" style="width: 300px; height: 243px;" />

 

<strong class="example">Example 1:</strong>

```text

**Input:** digits = "23"
**Output:** ["ad","ae","af","bd","be","bf","cd","ce","cf"]

```

<strong class="example">Example 2:</strong>

```text

**Input:** digits = "2"
**Output:** ["a","b","c"]

```

 

**Constraints:**

	- `1 <= digits.length <= 4`

	- `digits[i]` is a digit in the range `['2', '9']`.

</details>

**Category:** Tier 2 · Reinforce
**Pattern:** Backtracking over digit map  **Time:** O(4^n · n)  **Space:** O(n)
**Approach:** Map each digit to its letters and build strings position by position. At depth `d` iterate over the letters of `digits[d]`, append one, recurse, then remove it. The leaf at depth `digits.length()` is a complete combination.


```java
class Solution {
    private static final String[] MAP = {
        "", "", "abc", "def", "ghi", "jkl", "mno", "pqrs", "tuv", "wxyz" // Digit to letters mapping
    };

    public List<String> letterCombinations(String digits) {
        List<String> res = new ArrayList<>(); // Resulting combinations
        if (digits.isEmpty()) return res; // Handle edge case
        backtrack(digits, 0, new StringBuilder(), res); // Start from the 0th digit
        return res;
    }

    private void backtrack(String digits, int idx, StringBuilder sb,
                           List<String> res) {
        if (idx == digits.length()) { res.add(sb.toString()); return; } // Reached the end of the digit string
        String letters = MAP[digits.charAt(idx) - '0']; // Get the letters mapped to the current digit
        for (char ch : letters.toCharArray()) { // Try all possible letters for this digit
            sb.append(ch); // Append letter
            backtrack(digits, idx + 1, sb, res); // Move to the next digit
            sb.deleteCharAt(sb.length() - 1); // Backtrack
        }
    }
}
```

### Generate Parentheses

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Generate Parentheses](https://leetcode.com/problems/generate-parentheses/)


Given `n` pairs of parentheses, write a function to *generate all combinations of well-formed parentheses*.

 

<strong class="example">Example 1:</strong>

```text
**Input:** n = 3
**Output:** ["((()))","(()())","(())()","()(())","()()()"]

```

<strong class="example">Example 2:</strong>

```text
**Input:** n = 1
**Output:** ["()"]

```

 

**Constraints:**

	- `1 <= n <= 8`

</details>

**Category:** Tier 2 · Reinforce
**Pattern:** Backtracking with validity counts  **Time:** O(4^n / sqrt(n))  **Space:** O(n)
**Approach:** Track how many `(` and `)` remain. You may add `(` while opens remain, and `)` only while closes outnumber opens left (i.e. there is an unmatched open). This guarantees every generated string is balanced.


```java
class Solution {
    public List<String> generateParenthesis(int n) {
        List<String> res = new ArrayList<>(); // To store all valid combinations
        backtrack(n, n, new StringBuilder(), res); // Start with 'n' open and 'n' close parentheses available
        return res;
    }

    private void backtrack(int open, int close, StringBuilder sb,
                           List<String> res) {
        if (open == 0 && close == 0) { res.add(sb.toString()); return; } // Base case: all parentheses used
        if (open > 0) { // Can always add an open parenthesis if we have some left
            sb.append('('); // Add open parenthesis
            backtrack(open - 1, close, sb, res); // Recurse with one less open parenthesis available
            sb.deleteCharAt(sb.length() - 1); // Backtrack
        }
        if (close > open) { // Can only add a close parenthesis if it has a matching open one already placed
            sb.append(')'); // Add close parenthesis
            backtrack(open, close - 1, sb, res); // Recurse with one less close parenthesis available
            sb.deleteCharAt(sb.length() - 1); // Backtrack
        }
    }
}
```

### Palindrome Partitioning

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Palindrome Partitioning](https://leetcode.com/problems/palindrome-partitioning/)


Given a string `s`, partition `s` such that every <span data-keyword="substring-nonempty">substring</span> of the partition is a <span data-keyword="palindrome-string">**palindrome**</span>. Return *all possible palindrome partitioning of *`s`.

 

<strong class="example">Example 1:</strong>

```text
**Input:** s = "aab"
**Output:** [["a","a","b"],["aa","b"]]

```

<strong class="example">Example 2:</strong>

```text
**Input:** s = "a"
**Output:** [["a"]]

```

 

**Constraints:**

	- `1 <= s.length <= 16`

	- `s` contains only lowercase English letters.

</details>

**Category:** Tier 2 · Reinforce
**Pattern:** Backtracking on cut points  **Time:** O(n · 2^n)  **Space:** O(n)
**Approach:** Try every prefix `s[start..i]` as the next piece; if it is a palindrome, recurse on the remainder. Each valid full path from index 0 to `n` is one partition into palindromes.


```java
class Solution {
    public List<List<String>> partition(String s) {
        List<List<String>> res = new ArrayList<>(); // To store the partitions
        backtrack(s, 0, new ArrayList<>(), res); // Start backtracking from index 0
        return res;
    }

    private void backtrack(String s, int start, List<String> path,
                           List<List<String>> res) {
        if (start == s.length()) { res.add(new ArrayList<>(path)); return; } // Reached the end of the string
        for (int i = start; i < s.length(); i++) { // Try every possible end index for the current palindrome
            if (!isPalindrome(s, start, i)) continue; // If the substring is not a palindrome, it's an invalid cut
            path.add(s.substring(start, i + 1)); // Add the valid palindrome segment
            backtrack(s, i + 1, path, res); // Recurse on the remaining part of the string
            path.remove(path.size() - 1); // Backtrack
        }
    }

    private boolean isPalindrome(String s, int l, int r) {
        while (l < r) if (s.charAt(l++) != s.charAt(r--)) return false; // Check characters from both ends
        return true; // Characters match, it's a palindrome
    }
}
```
**Alternative:** Precompute an `isPal[i][j]` DP table to make each palindrome check O(1), reducing total time to O(2^n).

### Word Search

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Word Search](https://leetcode.com/problems/word-search/)


Given an `m x n` grid of characters `board` and a string `word`, return `true` *if* `word` *exists in the grid*.

The word can be constructed from letters of sequentially adjacent cells, where adjacent cells are horizontally or vertically neighboring. The same letter cell may not be used more than once.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2020/11/04/word2.jpg" style="width: 322px; height: 242px;" />

```text

**Input:** board = [["A","B","C","E"],["S","F","C","S"],["A","D","E","E"]], word = "ABCCED"
**Output:** true

```

<strong class="example">Example 2:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2020/11/04/word-1.jpg" style="width: 322px; height: 242px;" />

```text

**Input:** board = [["A","B","C","E"],["S","F","C","S"],["A","D","E","E"]], word = "SEE"
**Output:** true

```

<strong class="example">Example 3:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2020/10/15/word3.jpg" style="width: 322px; height: 242px;" />

```text

**Input:** board = [["A","B","C","E"],["S","F","C","S"],["A","D","E","E"]], word = "ABCB"
**Output:** false

```

 

**Constraints:**

	- `m == board.length`

	- `n = board[i].length`

	- `1 <= m, n <= 6`

	- `1 <= word.length <= 15`

	- `board` and `word` consists of only lowercase and uppercase English letters.

 

**Follow up:** Could you use search pruning to make your solution faster with a larger `board`?

</details>

**Category:** ⭐ Tier 1 · Core
**Pattern:** Backtracking / DFS on grid  **Time:** O(m·n·4^L)  **Space:** O(L) recursion
**Approach:** From each cell, DFS in four directions matching the word character by character. Mark visited cells in place (overwrite then restore) to avoid reuse within a single path. Return true as soon as any path spells the full word.


```java
class Solution {
    public boolean exist(char[][] board, String word) {
        int m = board.length, n = board[0].length; // Get board dimensions
        for (int r = 0; r < m; r++) // Iterate through every row
            for (int c = 0; c < n; c++) // Iterate through every column
                if (dfs(board, word, 0, r, c)) return true; // Start DFS, return early if found
        return false; // Word not found anywhere
    }

    private boolean dfs(char[][] b, String w, int idx, int r, int c) {
        if (idx == w.length()) return true; // Base case: all characters in the word have been matched
        // Check out of bounds or character mismatch
        if (r < 0 || c < 0 || r >= b.length || c >= b[0].length
            || b[r][c] != w.charAt(idx)) return false; 
        char tmp = b[r][c]; // Store original character
        b[r][c] = '#'; // Mark cell as visited to avoid reusing it in the same path
        // Explore all 4 adjacent directions (down, up, right, left)
        boolean found = dfs(b, w, idx + 1, r + 1, c)
                     || dfs(b, w, idx + 1, r - 1, c)
                     || dfs(b, w, idx + 1, r, c + 1)
                     || dfs(b, w, idx + 1, r, c - 1);
        b[r][c] = tmp; // Restore the cell's original character (backtrack)
        return found; // Return if the word was found along any of these paths
    }
}
```

### N-Queens

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [N-Queens](https://leetcode.com/problems/n-queens/)


The **n-queens** puzzle is the problem of placing `n` queens on an `n x n` chessboard such that no two queens attack each other.

Given an integer `n`, return *all distinct solutions to the **n-queens puzzle***. You may return the answer in **any order**.

Each solution contains a distinct board configuration of the n-queens' placement, where `'Q'` and `'.'` both indicate a queen and an empty space, respectively.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2020/11/13/queens.jpg" style="width: 600px; height: 268px;" />

```text

**Input:** n = 4
**Output:** [[".Q..","...Q","Q...","..Q."],["..Q.","Q...","...Q",".Q.."]]
**Explanation:** There exist two distinct solutions to the 4-queens puzzle as shown above

```

<strong class="example">Example 2:</strong>

```text

**Input:** n = 1
**Output:** [["Q"]]

```

 

**Constraints:**

	- `1 <= n <= 9`

</details>

**Category:** Tier 2 · Reinforce
**Pattern:** Backtracking + constraint sets  **Time:** O(n!)  **Space:** O(n)
**Approach:** Place one queen per row. Track attacked columns and both diagonals (`row - col` and `row + col`) in sets for O(1) conflict checks. When a column is safe, place, recurse to the next row, then undo.


```java
class Solution {
    public List<List<String>> solveNQueens(int n) {
        List<List<String>> res = new ArrayList<>(); // To store valid board configurations
        int[] queens = new int[n];        // queens[r] = column: array maps row to column index of the queen
        boolean[] cols = new boolean[n]; // Tracks columns that already have a queen
        boolean[] diag = new boolean[2 * n];  // row + col: tracks one set of diagonals
        boolean[] anti = new boolean[2 * n];  // row - col + n: tracks the other set of diagonals
        backtrack(0, n, queens, cols, diag, anti, res); // Start placing queens from row 0
        return res;
    }

    private void backtrack(int row, int n, int[] queens, boolean[] cols,
                           boolean[] diag, boolean[] anti,
                           List<List<String>> res) {
        if (row == n) { res.add(build(queens, n)); return; } // All queens placed successfully
        for (int col = 0; col < n; col++) { // Try placing a queen in each column of the current row
            int d = row + col, a = row - col + n; // Calculate diagonal identifiers
            if (cols[col] || diag[d] || anti[a]) continue; // Check if the position is under attack
            queens[row] = col; // Place queen
            cols[col] = diag[d] = anti[a] = true; // Mark column and diagonals as attacked
            backtrack(row + 1, n, queens, cols, diag, anti, res); // Recurse to the next row
            cols[col] = diag[d] = anti[a] = false; // Backtrack: remove queen and unmark attacks
        }
    }

    private List<String> build(int[] queens, int n) {
        List<String> board = new ArrayList<>(); // Construct string representation of the board
        for (int r = 0; r < n; r++) { // Iterate rows
            char[] line = new char[n]; // Create an empty row
            Arrays.fill(line, '.'); // Fill with empty spaces
            line[queens[r]] = 'Q'; // Place the queen
            board.add(new String(line)); // Add row to the board
        }
        return board;
    }
}
```

### Sudoku Solver

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Sudoku Solver](https://leetcode.com/problems/sudoku-solver/)


Write a program to solve a Sudoku puzzle by filling the empty cells.

A sudoku solution must satisfy **all of the following rules**:

<ol>
	- Each of the digits `1-9` must occur exactly once in each row.

	- Each of the digits `1-9` must occur exactly once in each column.

	- Each of the digits `1-9` must occur exactly once in each of the 9 `3x3` sub-boxes of the grid.

</ol>

The `'.'` character indicates empty cells.

 

<strong class="example">Example 1:</strong>
<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Sudoku-by-L2G-20050714.svg/250px-Sudoku-by-L2G-20050714.svg.png" style="height:250px; width:250px" />

```text

**Input:** board = [["5","3",".",".","7",".",".",".","."],["6",".",".","1","9","5",".",".","."],[".","9","8",".",".",".",".","6","."],["8",".",".",".","6",".",".",".","3"],["4",".",".","8",".","3",".",".","1"],["7",".",".",".","2",".",".",".","6"],[".","6",".",".",".",".","2","8","."],[".",".",".","4","1","9",".",".","5"],[".",".",".",".","8",".",".","7","9"]]
**Output:** [["5","3","4","6","7","8","9","1","2"],["6","7","2","1","9","5","3","4","8"],["1","9","8","3","4","2","5","6","7"],["8","5","9","7","6","1","4","2","3"],["4","2","6","8","5","3","7","9","1"],["7","1","3","9","2","4","8","5","6"],["9","6","1","5","3","7","2","8","4"],["2","8","7","4","1","9","6","3","5"],["3","4","5","2","8","6","1","7","9"]]
**Explanation:** The input board is shown above and the only valid solution is shown below:

<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Sudoku-by-L2G-20050714_solution.svg/250px-Sudoku-by-L2G-20050714_solution.svg.png" style="height:250px; width:250px" />

```

 

**Constraints:**

	- `board.length == 9`

	- `board[i].length == 9`

	- `board[i][j]` is a digit or `'.'`.

	- It is **guaranteed** that the input board has only one solution.

</details>

**Category:** Tier 3 · Reference
**Pattern:** Backtracking + constraint check  **Time:** O(9^(empty cells))  **Space:** O(1) board in place
**Approach:** Find the next empty cell, try digits 1–9, and keep only those valid for the current row, column, and 3×3 box. Recurse; if the recursion fully fills the board, propagate success, otherwise reset the cell and try the next digit.


```java
class Solution {
    public void solveSudoku(char[][] board) {
        solve(board); // Start solving
    }

    private boolean solve(char[][] b) {
        for (int r = 0; r < 9; r++) { // Iterate rows
            for (int c = 0; c < 9; c++) { // Iterate columns
                if (b[r][c] != '.') continue; // Skip already filled cells
                for (char d = '1'; d <= '9'; d++) { // Try placing digits '1' through '9'
                    if (!valid(b, r, c, d)) continue; // Skip invalid digits based on Sudoku rules
                    b[r][c] = d; // Place the digit
                    if (solve(b)) return true; // Recurse; if it leads to a solution, we are done
                    b[r][c] = '.'; // Backtrack: the chosen digit didn't work, clear the cell
                }
                return false; // No digit from 1-9 fits here, so the current path is invalid
            }
        }
        return true; // No empty cell left, puzzle solved!
    }

    private boolean valid(char[][] b, int r, int c, char d) {
        int br = (r / 3) * 3, bc = (c / 3) * 3; // Calculate the top-left corner of the 3x3 sub-box
        for (int i = 0; i < 9; i++) { // Check the row, column, and sub-box
            if (b[r][i] == d || b[i][c] == d) return false; // Check row and column for duplicate
            if (b[br + i / 3][bc + i % 3] == d) return false; // Check 3x3 sub-box for duplicate
        }
        return true; // Digit 'd' is valid in cell (r, c)
    }
}
```

### Restore IP Addresses

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Restore IP Addresses](https://leetcode.com/problems/restore-ip-addresses/)


A **valid IP address** consists of exactly four integers separated by single dots. Each integer is between `0` and `255` (**inclusive**) and cannot have leading zeros.

	- For example, `"0.1.2.201"` and `"192.168.1.1"` are **valid** IP addresses, but `"0.011.255.245"`, `"192.168.1.312"` and `"192.168@1.1"` are **invalid** IP addresses.

Given a string `s` containing only digits, return *all possible valid IP addresses that can be formed by inserting dots into *`s`. You are **not** allowed to reorder or remove any digits in `s`. You may return the valid IP addresses in **any** order.

 

<strong class="example">Example 1:</strong>

```text

**Input:** s = "25525511135"
**Output:** ["255.255.11.135","255.255.111.35"]

```

<strong class="example">Example 2:</strong>

```text

**Input:** s = "0000"
**Output:** ["0.0.0.0"]

```

<strong class="example">Example 3:</strong>

```text

**Input:** s = "101023"
**Output:** ["1.0.10.23","1.0.102.3","10.1.0.23","10.10.2.3","101.0.2.3"]

```

 

**Constraints:**

	- `1 <= s.length <= 20`

	- `s` consists of digits only.

</details>

**Category:** Tier 3 · Reference
**Pattern:** Backtracking on segments  **Time:** O(1) (bounded ≤ 3^4)  **Space:** O(1)
**Approach:** Split the string into exactly 4 segments. Each segment is 1–3 digits, value `<= 255`, and has no leading zero (unless it is exactly "0"). Recurse over segment lengths and stop when 4 valid segments consume the whole string.


```java
class Solution {
    public List<String> restoreIpAddresses(String s) {
        List<String> res = new ArrayList<>(); // To store valid IP addresses
        backtrack(s, 0, 0, new StringBuilder(), res); // Start backtracking
        return res;
    }

    private void backtrack(String s, int start, int part, StringBuilder sb,
                           List<String> res) {
        if (part == 4) { // An IP must have exactly 4 parts
            if (start == s.length()) res.add(sb.substring(0, sb.length() - 1)); // Valid if we've used the entire string
            return; // Backtrack regardless
        }
        for (int len = 1; len <= 3 && start + len <= s.length(); len++) { // Try segment lengths of 1, 2, and 3
            String seg = s.substring(start, start + len); // Extract the segment
            if (seg.length() > 1 && seg.charAt(0) == '0') break; // Prune: leading zero is invalid, and further lengths will also be invalid
            if (Integer.parseInt(seg) > 255) break; // Prune: segment value > 255 is invalid, longer lengths will also be > 255
            int mark = sb.length(); // Save the current StringBuilder length to backtrack cleanly
            sb.append(seg).append('.'); // Append segment and a dot
            backtrack(s, start + len, part + 1, sb, res); // Recurse to find the next part
            sb.setLength(mark); // Undo: backtrack by restoring StringBuilder length
        }
    }
}
```
