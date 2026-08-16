# 01 · Arrays, Two Pointers, Sliding Window & Prefix Sum

A pattern-first cheatsheet for the core array techniques: two pointers, sliding window, prefix sums, Kadane, and cyclic sort — each with a recognition note, a reusable template, and worked signature problems in idiomatic Java.

---

## 1. Two Pointers — Opposite Ends

**When to use / how to recognize it:** The input is sorted (or sortable) and you want a pair/triple meeting a condition, or you must shrink a range from both sides (palindrome, water container). Start one pointer at index `0`, one at `n-1`, and move them toward each other based on a comparison. Turns an O(n²) pair search into O(n).

**Template:**
```java
int lo = 0, hi = arr.length - 1; // Start pointers at the absolute left and right ends of the array
while (lo < hi) { // Continue searching as long as the pointers haven't crossed or met
    int sum = arr[lo] + arr[hi]; // Calculate the sum of the current pair of elements
    if (sum == target) { /* found */ break; } // If the target sum is found, exit the loop
    else if (sum < target) lo++;   // If sum is too small, move left pointer right to increase sum
    else hi--;                      // If sum is too large, move right pointer left to decrease sum
}
```

### Two Sum II (Input Array Is Sorted)

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Two Sum II (Input Array Is Sorted)](https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/)


Given a **1-indexed** array of integers `numbers` that is already ***sorted in non-decreasing order***, find two numbers such that they add up to a specific `target` number. Let these two numbers be `numbers[index<sub>1</sub>]` and `numbers[index<sub>2</sub>]` where `1 <= index<sub>1</sub> < index<sub>2</sub> <= numbers.length`.

Return* the indices of the two numbers *`index<sub>1</sub>`* and *`index<sub>2</sub>`*, **each incremented by one,** as an integer array *`[index<sub>1</sub>, index<sub>2</sub>]`* of length 2.*

The tests are generated such that there is **exactly one solution**. You **may not** use the same element twice.

Your solution must use only constant extra space.

 

<strong class="example">Example 1:</strong>

```text

**Input:** numbers = [<u>2</u>,<u>7</u>,11,15], target = 9
**Output:** [1,2]
**Explanation:** The sum of 2 and 7 is 9. Therefore, index<sub>1</sub> = 1, index<sub>2</sub> = 2. We return [1, 2].

```

<strong class="example">Example 2:</strong>

```text

**Input:** numbers = [<u>2</u>,3,<u>4</u>], target = 6
**Output:** [1,3]
**Explanation:** The sum of 2 and 4 is 6. Therefore index<sub>1</sub> = 1, index<sub>2</sub> = 3. We return [1, 3].

```

<strong class="example">Example 3:</strong>

```text

**Input:** numbers = [<u>-1</u>,<u>0</u>], target = -1
**Output:** [1,2]
**Explanation:** The sum of -1 and 0 is -1. Therefore index<sub>1</sub> = 1, index<sub>2</sub> = 2. We return [1, 2].

```

 

**Constraints:**

	- `2 <= numbers.length <= 3 * 10<sup>4</sup>`

	- `-1000 <= numbers[i] <= 1000`

	- `numbers` is sorted in **non-decreasing order**.

	- `-1000 <= target <= 1000`

	- The tests are generated such that there is **exactly one solution**.

</details>

**Category:** Tier 2 · Reinforce
**Pattern:** Two pointers opposite ends  **Time:** O(n)  **Space:** O(1)
**Approach:** Because the array is sorted, place pointers at both ends. If the sum is too small, the only way to increase it is to move the left pointer right; if too large, move the right pointer left. Each element is visited at most once, so it is linear and needs no hash map.


```java
public int[] twoSum(int[] numbers, int target) {
    int lo = 0, hi = numbers.length - 1; // Initialize pointers at both ends of the sorted array
    while (lo < hi) { // Loop until the two pointers meet
        int sum = numbers[lo] + numbers[hi]; // Calculate the sum of the values at the current pointers
        if (sum == target) return new int[]{lo + 1, hi + 1}; // Return 1-indexed positions if target sum is found
        else if (sum < target) lo++; // If the sum is less than target, move 'lo' right to increase the sum
        else hi--; // If the sum is greater than target, move 'hi' left to decrease the sum
    }
    return new int[]{-1, -1}; // Return a default invalid pair if no valid two sum is found
}
```

### 3Sum

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [3Sum](https://leetcode.com/problems/3sum/)


Given an integer array nums, return all the triplets `[nums[i], nums[j], nums[k]]` such that `i != j`, `i != k`, and `j != k`, and `nums[i] + nums[j] + nums[k] == 0`.

Notice that the solution set must not contain duplicate triplets.

 

<strong class="example">Example 1:</strong>

```text

**Input:** nums = [-1,0,1,2,-1,-4]
**Output:** [[-1,-1,2],[-1,0,1]]
**Explanation:** 
nums[0] + nums[1] + nums[2] = (-1) + 0 + 1 = 0.
nums[1] + nums[2] + nums[4] = 0 + 1 + (-1) = 0.
nums[0] + nums[3] + nums[4] = (-1) + 2 + (-1) = 0.
The distinct triplets are [-1,0,1] and [-1,-1,2].
Notice that the order of the output and the order of the triplets does not matter.

```

<strong class="example">Example 2:</strong>

```text

**Input:** nums = [0,1,1]
**Output:** []
**Explanation:** The only possible triplet does not sum up to 0.

```

<strong class="example">Example 3:</strong>

```text

**Input:** nums = [0,0,0]
**Output:** [[0,0,0]]
**Explanation:** The only possible triplet sums up to 0.

```

 

**Constraints:**

	- `3 <= nums.length <= 3000`

	- `-10<sup>5</sup> <= nums[i] <= 10<sup>5</sup>`

</details>

**Category:** ⭐ Tier 1 · Core
**Pattern:** Sort + two pointers opposite ends  **Time:** O(n²)  **Space:** O(1) (excluding output)
**Approach:** Sort the array, then fix each index `i` and run a two-pointer scan on the remainder looking for pairs summing to `-nums[i]`. Skip duplicate values for both the fixed element and the moving pointers to avoid duplicate triplets. Once `nums[i] > 0` we can stop, since all remaining numbers are positive.


```java
public List<List<Integer>> threeSum(int[] nums) {
    Arrays.sort(nums); // Sort the array to easily manage duplicates and use two pointers
    List<List<Integer>> res = new ArrayList<>(); // Initialize the result list to hold all unique triplets
    for (int i = 0; i < nums.length - 2; i++) { // Iterate through the array, leaving room for at least 2 more elements
        if (nums[i] > 0) break; // If the current number is positive, sum can't be zero since array is sorted
        if (i > 0 && nums[i] == nums[i - 1]) continue; // Skip duplicate values for the pivot to avoid duplicate triplets
        int lo = i + 1, hi = nums.length - 1; // Set two pointers: one just after pivot, one at the end
        while (lo < hi) { // Search for a valid pair in the remaining array
            int sum = nums[i] + nums[lo] + nums[hi]; // Calculate the current triplet sum
            if (sum == 0) { // If the sum is zero, we found a valid triplet
                res.add(Arrays.asList(nums[i], nums[lo], nums[hi])); // Add the triplet to the result list
                while (lo < hi && nums[lo] == nums[lo + 1]) lo++; // Skip any duplicate elements for the left pointer
                while (lo < hi && nums[hi] == nums[hi - 1]) hi--; // Skip any duplicate elements for the right pointer
                lo++; hi--; // Move both pointers inward after processing the current valid triplet
            } else if (sum < 0) lo++; // If sum is negative, we need a larger value, so move left pointer right
            else hi--; // If sum is positive, we need a smaller value, so move right pointer left
        }
    }
    return res; // Return the final list of triplets
}
```

### Container With Most Water

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Container With Most Water](https://leetcode.com/problems/container-with-most-water/)


You are given an integer array `height` of length `n`. There are `n` vertical lines drawn such that the two endpoints of the `i<sup>th</sup>` line are `(i, 0)` and `(i, height[i])`.

Find two lines that together with the x-axis form a container, such that the container contains the most water.

Return *the maximum amount of water a container can store*.

**Notice** that you may not slant the container.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://s3-lc-upload.s3.amazonaws.com/uploads/2018/07/17/question_11.jpg" style="width: 600px; height: 287px;" />

```text

**Input:** height = [1,8,6,2,5,4,8,3,7]
**Output:** 49
**Explanation:** The above vertical lines are represented by array [1,8,6,2,5,4,8,3,7]. In this case, the max area of water (blue section) the container can contain is 49.

```

<strong class="example">Example 2:</strong>

```text

**Input:** height = [1,1]
**Output:** 1

```

 

**Constraints:**

	- `n == height.length`

	- `2 <= n <= 10<sup>5</sup>`

	- `0 <= height[i] <= 10<sup>4</sup>`

</details>

**Category:** ⭐ Tier 1 · Core
**Pattern:** Two pointers opposite ends  **Time:** O(n)  **Space:** O(1)
**Approach:** Area is `min(height[lo], height[hi]) * (hi - lo)`. Start at the widest pair. Moving the taller wall inward can never help (width shrinks, height capped by the shorter wall), so always move the shorter wall — that is the only move that could yield a taller bottleneck and a larger area.


```java
public int maxArea(int[] height) {
    int lo = 0, hi = height.length - 1, best = 0; // Initialize pointers at ends, and max area tracker
    while (lo < hi) { // Loop until the two pointers meet
        int area = Math.min(height[lo], height[hi]) * (hi - lo); // Calculate area using the shorter wall and width
        best = Math.max(best, area); // Update the maximum area found so far
        if (height[lo] < height[hi]) lo++; // Move the pointer corresponding to the shorter wall inwards to seek a taller wall
        else hi--; // If right wall is shorter or equal, move right pointer inwards
    }
    return best; // Return the maximum water container area
}
```

### Trapping Rain Water

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Trapping Rain Water](https://leetcode.com/problems/trapping-rain-water/)


Given `n` non-negative integers representing an elevation map where the width of each bar is `1`, compute how much water it can trap after raining.

 

<strong class="example">Example 1:</strong>
<img src="https://assets.leetcode.com/uploads/2018/10/22/rainwatertrap.png" style="width: 412px; height: 161px;" />

```text

**Input:** height = [0,1,0,2,1,0,1,3,2,1,2,1]
**Output:** 6
**Explanation:** The above elevation map (black section) is represented by array [0,1,0,2,1,0,1,3,2,1,2,1]. In this case, 6 units of rain water (blue section) are being trapped.

```

<strong class="example">Example 2:</strong>

```text

**Input:** height = [4,2,0,3,2,5]
**Output:** 9

```

 

**Constraints:**

	- `n == height.length`

	- `1 <= n <= 2 * 10<sup>4</sup>`

	- `0 <= height[i] <= 10<sup>5</sup>`

</details>

**Category:** ⭐ Tier 1 · Core
**Pattern:** Two pointers opposite ends  **Time:** O(n)  **Space:** O(1)
**Approach:** Water above a bar equals `min(maxLeft, maxRight) - height[i]`. Maintain running `leftMax`/`rightMax`. Whichever side has the smaller wall is the binding constraint, so we can safely compute that side's trapped water and advance that pointer — the smaller running max is guaranteed to be the true bound for that cell.


```java
public int trap(int[] height) {
    int lo = 0, hi = height.length - 1; // Initialize two pointers at the ends of the elevation map
    int leftMax = 0, rightMax = 0, water = 0; // Track max heights from left and right, and total trapped water
    while (lo < hi) { // Loop until the pointers meet
        if (height[lo] < height[hi]) { // The left wall is the bottleneck limiting the trapped water here
            leftMax = Math.max(leftMax, height[lo]); // Update the maximum wall height seen from the left
            water += leftMax - height[lo]; // Add water trapped above the current left bar
            lo++; // Move the left pointer inwards
        } else { // The right wall is the bottleneck
            rightMax = Math.max(rightMax, height[hi]); // Update the maximum wall height seen from the right
            water += rightMax - height[hi]; // Add water trapped above the current right bar
            hi--; // Move the right pointer inwards
        }
    }
    return water; // Return the total trapped rain water
}
```

**Alternative (monotonic stack):** Keep a stack of decreasing bar indices. When the current bar is taller than the top, pop it as a "bottom"; the trapped width spans from the new stack top to the current index, bounded in height by `min(left, current) - bottom`. O(n) time, O(n) space.

```java
public int trapStack(int[] height) {
    Deque<Integer> stack = new ArrayDeque<>(); // Stack stores indices of bars in strictly decreasing height order
    int water = 0; // Initialize total trapped water
    for (int i = 0; i < height.length; i++) { // Iterate through each bar in the elevation map
        while (!stack.isEmpty() && height[i] > height[stack.peek()]) { // Process when current bar is taller than the bar at stack top
            int bottom = stack.pop(); // The top of the stack is the lowest point (the 'bottom' of the trap)
            if (stack.isEmpty()) break; // If no left boundary exists, water cannot be trapped, so break
            int left = stack.peek(); // The new top of the stack acts as the left boundary
            int width = i - left - 1; // Calculate the width of the trapped water region
            int bounded = Math.min(height[left], height[i]) - height[bottom]; // Calculate the effective height of trapped water
            water += width * bounded; // Add the volume of trapped water for this section
        }
        stack.push(i); // Push the current index onto the stack
    }
    return water; // Return the total trapped rain water
}
```

### Valid Palindrome

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Valid Palindrome](https://leetcode.com/problems/valid-palindrome/)


A phrase is a **palindrome** if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward. Alphanumeric characters include letters and numbers.

Given a string `s`, return `true`* if it is a **palindrome**, or *`false`* otherwise*.

 

<strong class="example">Example 1:</strong>

```text

**Input:** s = "A man, a plan, a canal: Panama"
**Output:** true
**Explanation:** "amanaplanacanalpanama" is a palindrome.

```

<strong class="example">Example 2:</strong>

```text

**Input:** s = "race a car"
**Output:** false
**Explanation:** "raceacar" is not a palindrome.

```

<strong class="example">Example 3:</strong>

```text

**Input:** s = " "
**Output:** true
**Explanation:** s is an empty string "" after removing non-alphanumeric characters.
Since an empty string reads the same forward and backward, it is a palindrome.

```

 

**Constraints:**

	- `1 <= s.length <= 2 * 10<sup>5</sup>`

	- `s` consists only of printable ASCII characters.

</details>

**Category:** Tier 3 · Reference
**Pattern:** Two pointers opposite ends  **Time:** O(n)  **Space:** O(1)
**Approach:** Walk inward from both ends, skipping any non-alphanumeric characters, and compare case-insensitively. If any mismatched pair is found the string is not a palindrome. No extra string allocation is needed.


```java
public boolean isPalindrome(String s) {
    int lo = 0, hi = s.length() - 1; // Start pointers at the beginning and end of the string
    while (lo < hi) { // Loop until the pointers meet or cross
        while (lo < hi && !Character.isLetterOrDigit(s.charAt(lo))) lo++; // Skip non-alphanumeric characters from the left
        while (lo < hi && !Character.isLetterOrDigit(s.charAt(hi))) hi--; // Skip non-alphanumeric characters from the right
        if (Character.toLowerCase(s.charAt(lo)) != Character.toLowerCase(s.charAt(hi))) // Compare characters case-insensitively
            return false; // If there is a mismatch, it's not a palindrome
        lo++; hi--; // Move both pointers inwards after a successful match
    }
    return true; // If all matched successfully, it is a valid palindrome
}
```

### Sort Colors (Dutch National Flag)

<!-- Problem Statement not automatically found -->

**Category:** ⭐ Tier 1 · Core
**Pattern:** Three pointers, one pass  **Time:** O(n)  **Space:** O(1)
**Approach:** Maintain three regions: `[0,low)` are 0s, `[low,mid)` are 1s, `(high,end]` are 2s. Scan with `mid`: a 0 swaps into the low region; a 2 swaps into the high region (and do not advance `mid`, since the swapped-in value is unexamined); a 1 stays put. Sorts {0,1,2} in a single pass.


```java
public void sortColors(int[] nums) {
    int low = 0, mid = 0, high = nums.length - 1; // low tracks 0s, mid scans, high tracks 2s
    while (mid <= high) { // Scan elements until mid crosses high
        if (nums[mid] == 0) { // If the current element is 0
            swap(nums, low++, mid++); // Swap it to the low region and advance both pointers
        } else if (nums[mid] == 1) { // If the current element is 1
            mid++; // It's in the correct middle region, just advance the mid pointer
        } else { // If the current element is 2
            swap(nums, mid, high--); // Swap it to the high region, but do NOT advance mid because the swapped-in value needs to be checked
        }
    }
}
private void swap(int[] a, int i, int j) { int t = a[i]; a[i] = a[j]; a[j] = t; } // Helper method to swap two elements in the array
```

---

## 2. Two Pointers — Same Direction (Fast/Slow Writer)

**When to use / how to recognize it:** You overwrite an array in place by filtering or compacting it. A slow `write` pointer marks where the next kept element goes; a fast `read` pointer scans forward. Useful for in-place removal and partitioning while keeping O(1) space.

**Template:**
```java
int write = 0; // Pointer tracking the index where the next valid element should be written
for (int read = 0; read < arr.length; read++) { // Pointer scanning through all elements of the array
    if (keep(arr[read])) { // Check if the current scanned element meets the condition to be kept
        arr[write++] = arr[read]; // Write the kept element to the write index, then increment write pointer
    }
}
// arr[0..write) is the result // The valid elements are now compacted in the prefix of the array
```

### Remove Duplicates from Sorted Array

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Remove Duplicates from Sorted Array](https://leetcode.com/problems/remove-duplicates-from-sorted-array/)


Given an integer array `nums` sorted in **non-decreasing order**, remove the duplicates <a href="https://en.wikipedia.org/wiki/In-place_algorithm" target="_blank">**in-place**</a> such that each unique element appears only **once**. The **relative order** of the elements should be kept the **same**.

Consider the number of *unique elements* in `nums` to be `k**​​​​​​​**`​​​​​​​. <meta charset="UTF-8" />After removing duplicates, return the number of unique elements `k`.

<meta charset="UTF-8" />The first `k` elements of `nums` should contain the unique numbers in **sorted order**. The remaining elements beyond index `k - 1` can be ignored.

**Custom Judge:**

The judge will test your solution with the following code:

```text

int[] nums = [...]; // Input array
int[] expectedNums = [...]; // The expected answer with correct length

int k = removeDuplicates(nums); // Calls your implementation

assert k == expectedNums.length;
for (int i = 0; i < k; i++) {
    assert nums[i] == expectedNums[i];
}

```

If all assertions pass, then your solution will be **accepted**.

 

<strong class="example">Example 1:</strong>

```text

**Input:** nums = [1,1,2]
**Output:** 2, nums = [1,2,_]
**Explanation:** Your function should return k = 2, with the first two elements of nums being 1 and 2 respectively.
It does not matter what you leave beyond the returned k (hence they are underscores).

```

<strong class="example">Example 2:</strong>

```text

**Input:** nums = [0,0,1,1,1,2,2,3,3,4]
**Output:** 5, nums = [0,1,2,3,4,_,_,_,_,_]
**Explanation:** Your function should return k = 5, with the first five elements of nums being 0, 1, 2, 3, and 4 respectively.
It does not matter what you leave beyond the returned k (hence they are underscores).

```

 

**Constraints:**

	- `1 <= nums.length <= 3 * 10<sup>4</sup>`

	- `-100 <= nums[i] <= 100`

	- `nums` is sorted in **non-decreasing** order.

</details>

**Category:** Tier 3 · Reference
**Pattern:** Same-direction two pointers  **Time:** O(n)  **Space:** O(1)
**Approach:** Since the array is sorted, duplicates are adjacent. Keep a `write` index pointing at the last unique element; for each `read`, write only when it differs from the previous kept value. Return the new length `write + 1`.


```java
public int removeDuplicates(int[] nums) {
    if (nums.length == 0) return 0; // If the array is empty, the new length is 0
    int write = 0; // Pointer tracking the position of the last unique element written
    for (int read = 1; read < nums.length; read++) { // Scan the array starting from the second element
        if (nums[read] != nums[write]) { // If a new unique element is found
            nums[++write] = nums[read]; // Increment write pointer and place the unique element there
        }
    }
    return write + 1; // Return the number of unique elements (length of the valid prefix)
}
```

### Move Zeroes

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Move Zeroes](https://leetcode.com/problems/move-zeroes/)


Given an integer array `nums`, move all `0`'s to the end of it while maintaining the relative order of the non-zero elements.

**Note** that you must do this in-place without making a copy of the array.

 

<strong class="example">Example 1:</strong>

```text
**Input:** nums = [0,1,0,3,12]
**Output:** [1,3,12,0,0]

```

<strong class="example">Example 2:</strong>

```text
**Input:** nums = [0]
**Output:** [0]

```

 

**Constraints:**

	- `1 <= nums.length <= 10<sup>4</sup>`

	- `-2<sup>31</sup> <= nums[i] <= 2<sup>31</sup> - 1`

 
**Follow up:** Could you minimize the total number of operations done?

</details>

**Category:** Tier 3 · Reference
**Pattern:** Same-direction two pointers  **Time:** O(n)  **Space:** O(1)
**Approach:** A `write` pointer tracks where the next non-zero belongs. Swap each non-zero element into that slot as you scan; swapping (rather than overwriting) automatically pushes the zeroes to the back while preserving relative order of non-zeros.


```java
public void moveZeroes(int[] nums) {
    int write = 0; // Pointer tracking where the next non-zero element should be placed
    for (int read = 0; read < nums.length; read++) { // Scan through all elements of the array
        if (nums[read] != 0) { // Check if the current element is non-zero
            int t = nums[write]; nums[write] = nums[read]; nums[read] = t; // Swap the non-zero element with the element at the 'write' pointer
            write++; // Advance the write pointer to the next available position
        }
    }
}
```

---

## 3. Sliding Window — Fixed Size

**When to use / how to recognize it:** You need a statistic (sum/max/average) over every contiguous subarray of a fixed length `k`. Add the entering element and subtract the leaving element instead of recomputing — O(n) instead of O(n·k).

**Template:**
```java
int windowSum = 0; // Initialize a variable to track the sum (or other statistic) of the current window
for (int i = 0; i < arr.length; i++) { // Iterate through the array elements
    windowSum += arr[i];               // include arr[i] // Add the new element entering the window
    if (i >= k - 1) { // Once the window size reaches 'k' (at index k-1)
        // window is arr[i-k+1 .. i]
        result = combine(result, windowSum); // Process the valid window state (e.g., update max sum)
        windowSum -= arr[i - k + 1];   // evict left edge // Remove the element that is falling out of the window for the next iteration
    }
}
```

### Maximum Sum Subarray of Size K

<!-- Problem Statement not automatically found -->

**Category:** ⭐ Tier 1 · Core
**Pattern:** Fixed sliding window  **Time:** O(n)  **Space:** O(1)
**Approach:** Build the first window of size `k`, then slide one step at a time: add the new right element and remove the old left element, tracking the running maximum. Each element enters and leaves the window exactly once.


```java
public int maxSumSubarray(int[] nums, int k) {
    int windowSum = 0; // Variable to store the sum of the current sliding window
    for (int i = 0; i < k; i++) windowSum += nums[i]; // Precompute the sum for the very first window of size k
    int best = windowSum; // Initialize the best sum to the sum of the first window
    for (int i = k; i < nums.length; i++) { // Slide the window one element at a time starting from index k
        windowSum += nums[i] - nums[i - k]; // Add the new right element and subtract the old left element to get the new window sum
        best = Math.max(best, windowSum); // Update the maximum sum found so far
    }
    return best; // Return the maximum subarray sum of size k
}
```

---

## 4. Sliding Window — Variable Size

**When to use / how to recognize it:** You want the longest/shortest/optimal contiguous window satisfying a constraint (distinct chars, sum ≥ target, ≤ k of something). Expand `right` to grow the window; while the window is invalid (or to seek the minimum, while it is valid), shrink from `left`. Maintain a frequency map or counter as state.

**Template:**
```java
int left = 0; // Initialize the left pointer of the window
Map<Character,Integer> count = new HashMap<>(); // Data structure to keep track of state within the current window
for (int right = 0; right < s.length(); right++) { // Expand the window by moving the right pointer
    char c = s.charAt(right); // Get the current character entering the window
    count.merge(c, 1, Integer::sum);       // include right // Update the state with the new character
    while (windowInvalid(count)) {         // shrink until valid // If the window violates the constraint, shrink from the left
        char d = s.charAt(left++); // Get the character falling out of the window and increment left pointer
        count.merge(d, -1, Integer::sum); // Update the state by removing the left character
    }
    best = Math.max(best, right - left + 1); // Record the size of the valid window (or other metric)
}
```

### Longest Substring Without Repeating Characters

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Longest Substring Without Repeating Characters](https://leetcode.com/problems/longest-substring-without-repeating-characters/)


Given a string `s`, find the length of the **longest** <span data-keyword="substring-nonempty">**substring**</span> without duplicate characters.

 

<strong class="example">Example 1:</strong>

```text

**Input:** s = "abcabcbb"
**Output:** 3
**Explanation:** The answer is "abc", with the length of 3. Note that `"bca"` and `"cab"` are also correct answers.

```

<strong class="example">Example 2:</strong>

```text

**Input:** s = "bbbbb"
**Output:** 1
**Explanation:** The answer is "b", with the length of 1.

```

<strong class="example">Example 3:</strong>

```text

**Input:** s = "pwwkew"
**Output:** 3
**Explanation:** The answer is "wke", with the length of 3.
Notice that the answer must be a substring, "pwke" is a subsequence and not a substring.

```

 

**Constraints:**

	- `0 <= s.length <= 10<sup>5</sup>`

	- `s` consists of English letters, digits, symbols and spaces.

</details>

**Category:** ⭐ Tier 1 · Core
**Pattern:** Variable sliding window  **Time:** O(n)  **Space:** O(min(n, charset))
**Approach:** Track the last index seen for each character. When a repeat falls inside the current window, jump `left` to just past the previous occurrence. The window `[left, right]` always holds distinct characters, so its width gives a candidate answer at every step.


```java
public int lengthOfLongestSubstring(String s) {
    Map<Character, Integer> lastSeen = new HashMap<>(); // Map to store the most recent index of each character
    int left = 0, best = 0; // Initialize left boundary of the window and the best length tracker
    for (int right = 0; right < s.length(); right++) { // Iterate to expand the window to the right
        char c = s.charAt(right); // The character entering the window
        if (lastSeen.containsKey(c) && lastSeen.get(c) >= left) { // If the character is already in the current valid window
            left = lastSeen.get(c) + 1; // Move the left boundary past the previous occurrence of this character to remove the duplicate
        }
        lastSeen.put(c, right); // Update the last seen index for the current character
        best = Math.max(best, right - left + 1); // Update the maximum length found so far with the current valid window length
    }
    return best; // Return the length of the longest substring without repeating characters
}
```

### Minimum Window Substring

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Minimum Window Substring](https://leetcode.com/problems/minimum-window-substring/)


Given two strings `s` and `t` of lengths `m` and `n` respectively, return *the **minimum window*** <span data-keyword="substring-nonempty">***substring***</span>* of *`s`* such that every character in *`t`* (**including duplicates**) is included in the window*. If there is no such substring, return *the empty string *`""`.

The testcases will be generated such that the answer is **unique**.

 

<strong class="example">Example 1:</strong>

```text

**Input:** s = "ADOBECODEBANC", t = "ABC"
**Output:** "BANC"
**Explanation:** The minimum window substring "BANC" includes 'A', 'B', and 'C' from string t.

```

<strong class="example">Example 2:</strong>

```text

**Input:** s = "a", t = "a"
**Output:** "a"
**Explanation:** The entire string s is the minimum window.

```

<strong class="example">Example 3:</strong>

```text

**Input:** s = "a", t = "aa"
**Output:** ""
**Explanation:** Both 'a's from t must be included in the window.
Since the largest window of s only has one 'a', return empty string.

```

 

**Constraints:**

	- `m == s.length`

	- `n == t.length`

	- `1 <= m, n <= 10<sup>5</sup>`

	- `s` and `t` consist of uppercase and lowercase English letters.

 

**Follow up:** Could you find an algorithm that runs in `O(m + n)` time?

</details>

**Category:** ⭐ Tier 1 · Core
**Pattern:** Variable sliding window (shrink-to-minimum)  **Time:** O(n + m)  **Space:** O(charset)
**Approach:** Count required characters of `t`. Expand `right`, decrementing the need; when a character's need reaches zero we have one fully-satisfied char (`formed`). Once all required chars are formed, shrink `left` as far as possible while still valid, recording the smallest window seen.


```java
public String minWindow(String s, String t) {
    if (s.length() < t.length()) return ""; // If the search string is shorter than the target, no valid window is possible
    int[] need = new int[128]; // Array to count the required occurrences of each character in t
    for (char c : t.toCharArray()) need[c]++; // Populate the requirements from string t
    int required = t.length();           // total chars still needed // Track the total number of characters from t we still need to match
    int left = 0, bestLen = Integer.MAX_VALUE, bestStart = 0; // Initialize window boundaries and best result trackers
    for (int right = 0; right < s.length(); right++) { // Expand the window to the right
        if (need[s.charAt(right)]-- > 0) required--; // If the current char is needed, decrement total required count, then update requirement
        while (required == 0) {          // valid window // While all required characters are present in the window
            if (right - left + 1 < bestLen) { // If the current window is smaller than the best found so far
                bestLen = right - left + 1; // Update the best length
                bestStart = left; // Update the starting index of the best window
            }
            if (need[s.charAt(left)]++ == 0) required++; // Before moving left pointer, if the leaving char was exactly fulfilling a need, increment required count
            left++; // Shrink the window from the left to seek a smaller valid window
        }
    }
    return bestLen == Integer.MAX_VALUE ? "" : s.substring(bestStart, bestStart + bestLen); // Return the best window substring or empty string if none found
}
```

### Longest Repeating Character Replacement

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Longest Repeating Character Replacement](https://leetcode.com/problems/longest-repeating-character-replacement/)


You are given a string `s` and an integer `k`. You can choose any character of the string and change it to any other uppercase English character. You can perform this operation at most `k` times.

Return *the length of the longest substring containing the same letter you can get after performing the above operations*.

 

<strong class="example">Example 1:</strong>

```text

**Input:** s = "ABAB", k = 2
**Output:** 4
**Explanation:** Replace the two 'A's with two 'B's or vice versa.

```

<strong class="example">Example 2:</strong>

```text

**Input:** s = "AABABBA", k = 1
**Output:** 4
**Explanation:** Replace the one 'A' in the middle with 'B' and form "AABBBBA".
The substring "BBBB" has the longest repeating letters, which is 4.
There may exists other ways to achieve this answer too.
```

 

**Constraints:**

	- `1 <= s.length <= 10<sup>5</sup>`

	- `s` consists of only uppercase English letters.

	- `0 <= k <= s.length`

</details>

**Category:** Tier 2 · Reinforce
**Pattern:** Variable sliding window  **Time:** O(n)  **Space:** O(1) (26 letters)
**Approach:** A window is valid if `(windowLength - countOfMostFrequentChar) <= k`, i.e. the non-majority chars can all be replaced within budget `k`. Track the max frequency seen. When the window becomes invalid, slide `left` forward by one (never shrinking the best answer, since we only ever grow the window when valid).


```java
public int characterReplacement(String s, int k) {
    int[] freq = new int[26]; // Frequency array to count occurrences of each uppercase English letter in the window
    int left = 0, maxFreq = 0, best = 0; // Initialize left boundary, max frequency of a single char in window, and best length
    for (int right = 0; right < s.length(); right++) { // Expand the window to the right
        freq[s.charAt(right) - 'A']++; // Increment the frequency of the incoming character
        maxFreq = Math.max(maxFreq, freq[s.charAt(right) - 'A']); // Update the maximum frequency of any single character in the window
        while ((right - left + 1) - maxFreq > k) { // If the number of characters to replace (window size - maxFreq) exceeds k
            freq[s.charAt(left) - 'A']--; // The window is invalid, so remove the leftmost character's frequency
            left++; // Shrink the window from the left
        }
        best = Math.max(best, right - left + 1); // Update the maximum valid window length found so far
    }
    return best; // Return the length of the longest valid substring
}
```

### Minimum Size Subarray Sum

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Minimum Size Subarray Sum](https://leetcode.com/problems/minimum-size-subarray-sum/)


Given an array of positive integers `nums` and a positive integer `target`, return *the **minimal length** of a *<span data-keyword="subarray-nonempty">*subarray*</span>* whose sum is greater than or equal to* `target`. If there is no such subarray, return `0` instead.

 

<strong class="example">Example 1:</strong>

```text

**Input:** target = 7, nums = [2,3,1,2,4,3]
**Output:** 2
**Explanation:** The subarray [4,3] has the minimal length under the problem constraint.

```

<strong class="example">Example 2:</strong>

```text

**Input:** target = 4, nums = [1,4,4]
**Output:** 1

```

<strong class="example">Example 3:</strong>

```text

**Input:** target = 11, nums = [1,1,1,1,1,1,1,1]
**Output:** 0

```

 

**Constraints:**

	- `1 <= target <= 10<sup>9</sup>`

	- `1 <= nums.length <= 10<sup>5</sup>`

	- `1 <= nums[i] <= 10<sup>4</sup>`

 
**Follow up:** If you have figured out the `O(n)` solution, try coding another solution of which the time complexity is `O(n log(n))`.

</details>

**Category:** Tier 2 · Reinforce
**Pattern:** Variable sliding window (shrink-to-minimum)  **Time:** O(n)  **Space:** O(1)
**Approach:** Grow a running sum by adding `right`. Whenever the sum reaches `target`, shrink from `left` as much as possible while still ≥ target, recording the shortest length each time. Works because all elements are positive, so shrinking strictly decreases the sum.


```java
public int minSubArrayLen(int target, int[] nums) {
    int left = 0, sum = 0, best = Integer.MAX_VALUE; // Initialize left boundary, current window sum, and best length to a large value
    for (int right = 0; right < nums.length; right++) { // Expand the window to the right
        sum += nums[right]; // Add the new element to the current window sum
        while (sum >= target) { // While the current window sum satisfies the condition
            best = Math.min(best, right - left + 1); // Update the minimum length found so far
            sum -= nums[left++]; // Subtract the leftmost element from the sum and shrink the window from the left to find smaller valid windows
        }
    }
    return best == Integer.MAX_VALUE ? 0 : best; // Return the minimum length, or 0 if no valid subarray was found
}
```

### Fruit Into Baskets

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Fruit Into Baskets](https://leetcode.com/problems/fruit-into-baskets/)


You are visiting a farm that has a single row of fruit trees arranged from left to right. The trees are represented by an integer array `fruits` where `fruits[i]` is the **type** of fruit the `i<sup>th</sup>` tree produces.

You want to collect as much fruit as possible. However, the owner has some strict rules that you must follow:

	- You only have **two** baskets, and each basket can only hold a **single type** of fruit. There is no limit on the amount of fruit each basket can hold.

	- Starting from any tree of your choice, you must pick **exactly one fruit** from **every** tree (including the start tree) while moving to the right. The picked fruits must fit in one of your baskets.

	- Once you reach a tree with fruit that cannot fit in your baskets, you must stop.

Given the integer array `fruits`, return *the **maximum** number of fruits you can pick*.

 

<strong class="example">Example 1:</strong>

```text

**Input:** fruits = [<u>1,2,1</u>]
**Output:** 3
**Explanation:** We can pick from all 3 trees.

```

<strong class="example">Example 2:</strong>

```text

**Input:** fruits = [0,<u>1,2,2</u>]
**Output:** 3
**Explanation:** We can pick from trees [1,2,2].
If we had started at the first tree, we would only pick from trees [0,1].

```

<strong class="example">Example 3:</strong>

```text

**Input:** fruits = [1,<u>2,3,2,2</u>]
**Output:** 4
**Explanation:** We can pick from trees [2,3,2,2].
If we had started at the first tree, we would only pick from trees [1,2].

```

 

**Constraints:**

	- `1 <= fruits.length <= 10<sup>5</sup>`

	- `0 <= fruits[i] < fruits.length`

</details>

**Category:** Tier 2 · Reinforce
**Pattern:** Variable sliding window (at most 2 distinct)  **Time:** O(n)  **Space:** O(1)
**Approach:** This is "longest subarray with at most 2 distinct values." Keep a frequency map of fruit types in the window; when more than 2 types appear, shrink from the left, removing types whose count hits zero. The widest valid window is the answer.


```java
public int totalFruit(int[] fruits) {
    Map<Integer, Integer> count = new HashMap<>(); // Map to track the count of each fruit type in the current window
    int left = 0, best = 0; // Initialize left boundary and the maximum number of fruits collected
    for (int right = 0; right < fruits.length; right++) { // Expand the window to the right
        count.merge(fruits[right], 1, Integer::sum); // Add the newly picked fruit to the basket (update frequency)
        while (count.size() > 2) { // If we have more than 2 types of fruits, the window is invalid
            int f = fruits[left++]; // Get the fruit type at the left boundary and move the left pointer
            if (count.merge(f, -1, Integer::sum) == 0) count.remove(f); // Decrement its count, and remove it from the map if count reaches 0
        }
        best = Math.max(best, right - left + 1); // Update the maximum number of fruits collected so far for a valid window
    }
    return best; // Return the maximum fruits that can be collected
}
```

---

## 5. Prefix Sum

**When to use / how to recognize it:** You need many range-sum queries, or you count/locate subarrays whose sum equals a value. Precompute cumulative sums so any range is an O(1) subtraction; pairing prefix sums with a hash map turns "subarray with sum X" into a one-pass counting problem.

**Template:**
```java
// 1D immutable range sum
int[] prefix = new int[n + 1];           // prefix[i] = sum of arr[0..i-1] // Array to store cumulative sums, with an extra 0 at the start
for (int i = 0; i < n; i++) prefix[i + 1] = prefix[i] + arr[i]; // Compute prefix sums by adding the current element to the previous sum
int rangeSum = prefix[r + 1] - prefix[l]; // sum of arr[l..r] // Retrieve the sum of any subarray in O(1) time using subtraction

// "subarray summing to k" via map of prefix-sum frequencies
Map<Integer,Integer> seen = new HashMap<>(); // Map to store the frequencies of prefix sums seen so far
seen.put(0, 1); // Seed the map with a prefix sum of 0 occurring once (to handle subarrays starting at index 0)
int running = 0; // Variable to keep track of the running prefix sum
for (int x : arr) { // Iterate through the array
    running += x; // Update the running sum with the current element
    // running - k was a previous prefix => a subarray sums to k // If (running - k) exists in the map, a valid subarray ends here
}
```

### Subarray Sum Equals K

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Subarray Sum Equals K](https://leetcode.com/problems/subarray-sum-equals-k/)


Given an array of integers `nums` and an integer `k`, return *the total number of subarrays whose sum equals to* `k`.

A subarray is a contiguous **non-empty** sequence of elements within an array.

 

<strong class="example">Example 1:</strong>

```text
**Input:** nums = [1,1,1], k = 2
**Output:** 2

```

<strong class="example">Example 2:</strong>

```text
**Input:** nums = [1,2,3], k = 3
**Output:** 2

```

 

**Constraints:**

	- `1 <= nums.length <= 2 * 10<sup>4</sup>`

	- `-1000 <= nums[i] <= 1000`

	- `-10<sup>7</sup> <= k <= 10<sup>7</sup>`

</details>

**Category:** ⭐ Tier 1 · Core
**Pattern:** Prefix sum + hash map  **Time:** O(n)  **Space:** O(n)
**Approach:** A subarray `(i,j]` sums to `k` iff `prefix[j] - prefix[i] == k`. Scan left to right keeping a map of how many times each prefix sum has occurred; at each step add the count of `running - k` previously seen. Seed the map with `{0:1}` to count subarrays starting at index 0.


```java
public int subarraySum(int[] nums, int k) {
    Map<Integer, Integer> seen = new HashMap<>(); // Map to store prefix sums and their frequencies
    seen.put(0, 1); // Seed map with sum=0 frequency=1 to handle subarrays starting at the beginning
    int running = 0, count = 0; // Initialize running prefix sum and total valid subarrays count
    for (int x : nums) { // Iterate through the array elements
        running += x; // Add the current element to the running prefix sum
        count += seen.getOrDefault(running - k, 0); // If (running - k) was seen, add its frequency to the valid subarrays count
        seen.merge(running, 1, Integer::sum); // Add the current running sum to the map or increment its frequency
    }
    return count; // Return the total number of subarrays that sum to k
}
```

### Product of Array Except Self

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Product of Array Except Self](https://leetcode.com/problems/product-of-array-except-self/)


Given an integer array `nums`, return *an array* `answer` *such that* `answer[i]` *is equal to the product of all the elements of* `nums` *except* `nums[i]`.

The product of any prefix or suffix of `nums` is **guaranteed** to fit in a **32-bit** integer.

You must write an algorithm that runs in `O(n)` time and without using the division operation.

 

<strong class="example">Example 1:</strong>

```text
**Input:** nums = [1,2,3,4]
**Output:** [24,12,8,6]

```

<strong class="example">Example 2:</strong>

```text
**Input:** nums = [-1,1,0,-3,3]
**Output:** [0,0,9,0,0]

```

 

**Constraints:**

	- `2 <= nums.length <= 10<sup>5</sup>`

	- `-30 <= nums[i] <= 30`

	- The input is generated such that `answer[i]` is **guaranteed** to fit in a **32-bit** integer.

 

**Follow up:** Can you solve the problem in `O(1)` extra space complexity? (The output array **does not** count as extra space for space complexity analysis.)

</details>

**Category:** ⭐ Tier 1 · Core
**Pattern:** Prefix / suffix products  **Time:** O(n)  **Space:** O(1) (excluding output)
**Approach:** First pass fills each slot with the product of everything to its left. Second pass walks from the right multiplying in a running suffix product. No division is used, so zeros are handled naturally.


```java
public int[] productExceptSelf(int[] nums) {
    int n = nums.length; // Get the length of the input array
    int[] res = new int[n]; // Array to hold the final result
    res[0] = 1; // The prefix product for the first element has nothing to its left, so start with 1
    for (int i = 1; i < n; i++) res[i] = res[i - 1] * nums[i - 1]; // prefix // Fill res with the product of all elements to the left of i
    int suffix = 1; // Initialize the running suffix product starting from the rightmost element
    for (int i = n - 1; i >= 0; i--) { // Traverse the array backwards
        res[i] *= suffix; // Multiply the prefix product already in res[i] by the running suffix product
        suffix *= nums[i]; // Update the running suffix product to include the current element
    }
    return res; // Return the final array of products
}
```

### Find Pivot Index

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Find Pivot Index](https://leetcode.com/problems/find-pivot-index/)


Given an array of integers `nums`, calculate the **pivot index** of this array.

The **pivot index** is the index where the sum of all the numbers **strictly** to the left of the index is equal to the sum of all the numbers **strictly** to the index's right.

If the index is on the left edge of the array, then the left sum is `0` because there are no elements to the left. This also applies to the right edge of the array.

Return *the **leftmost pivot index***. If no such index exists, return `-1`.

 

<strong class="example">Example 1:</strong>

```text

**Input:** nums = [1,7,3,6,5,6]
**Output:** 3
**Explanation:**
The pivot index is 3.
Left sum = nums[0] + nums[1] + nums[2] = 1 + 7 + 3 = 11
Right sum = nums[4] + nums[5] = 5 + 6 = 11

```

<strong class="example">Example 2:</strong>

```text

**Input:** nums = [1,2,3]
**Output:** -1
**Explanation:**
There is no index that satisfies the conditions in the problem statement.
```

<strong class="example">Example 3:</strong>

```text

**Input:** nums = [2,1,-1]
**Output:** 0
**Explanation:**
The pivot index is 0.
Left sum = 0 (no elements to the left of index 0)
Right sum = nums[1] + nums[2] = 1 + -1 = 0

```

 

**Constraints:**

	- `1 <= nums.length <= 10<sup>4</sup>`

	- `-1000 <= nums[i] <= 1000`

 

**Note:** This question is the same as 1991: <a href="https://leetcode.com/problems/find-the-middle-index-in-array/" target="_blank">https://leetcode.com/problems/find-the-middle-index-in-array/</a>

</details>

**Category:** Tier 3 · Reference
**Pattern:** Prefix sum  **Time:** O(n)  **Space:** O(1)
**Approach:** The pivot has equal left and right sums. Compute the total, then sweep left to right maintaining `leftSum`; the right sum is `total - leftSum - nums[i]`. Return the first index where these match.


```java
public int pivotIndex(int[] nums) {
    int total = 0; // Variable to store the total sum of all elements in the array
    for (int x : nums) total += x; // Compute the total sum
    int leftSum = 0; // Variable to track the sum of elements strictly to the left of the current index
    for (int i = 0; i < nums.length; i++) { // Iterate through the array to find the pivot
        if (leftSum == total - leftSum - nums[i]) return i; // If left sum equals right sum (total - left - current), return current index
        leftSum += nums[i]; // Add the current element to leftSum for the next iteration
    }
    return -1; // If no pivot index is found, return -1
}
```

### Continuous Subarray Sum

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Continuous Subarray Sum](https://leetcode.com/problems/continuous-subarray-sum/)


Given an integer array nums and an integer k, return `true` *if *`nums`* has a **good subarray** or *`false`* otherwise*.

A **good subarray** is a subarray where:

	- its length is **at least two**, and

	- the sum of the elements of the subarray is a multiple of `k`.

**Note** that:

	- A **subarray** is a contiguous part of the array.

	- An integer `x` is a multiple of `k` if there exists an integer `n` such that `x = n * k`. `0` is **always** a multiple of `k`.

 

<strong class="example">Example 1:</strong>

```text

**Input:** nums = [23,<u>2,4</u>,6,7], k = 6
**Output:** true
**Explanation:** [2, 4] is a continuous subarray of size 2 whose elements sum up to 6.

```

<strong class="example">Example 2:</strong>

```text

**Input:** nums = [<u>23,2,6,4,7</u>], k = 6
**Output:** true
**Explanation:** [23, 2, 6, 4, 7] is an continuous subarray of size 5 whose elements sum up to 42.
42 is a multiple of 6 because 42 = 7 * 6 and 7 is an integer.

```

<strong class="example">Example 3:</strong>

```text

**Input:** nums = [23,2,6,4,7], k = 13
**Output:** false

```

 

**Constraints:**

	- `1 <= nums.length <= 10<sup>5</sup>`

	- `0 <= nums[i] <= 10<sup>9</sup>`

	- `0 <= sum(nums[i]) <= 2<sup>31</sup> - 1`

	- `1 <= k <= 2<sup>31</sup> - 1`

</details>

**Category:** Tier 3 · Reference
**Pattern:** Prefix sum modulo + hash map  **Time:** O(n)  **Space:** O(min(n, k))
**Approach:** A subarray sum is a multiple of `k` iff two prefix sums share the same remainder mod `k`. Store the earliest index for each remainder; if the same remainder reappears at least two indices later, we have a valid subarray of length ≥ 2. Seed remainder `0` at index `-1`.


```java
public boolean checkSubarraySum(int[] nums, int k) {
    Map<Integer, Integer> firstIndex = new HashMap<>(); // Map to store the earliest index we saw a specific remainder
    firstIndex.put(0, -1); // Seed map with remainder 0 at index -1 to handle valid subarrays starting from index 0
    int running = 0; // Variable to track the running prefix sum
    for (int i = 0; i < nums.length; i++) { // Iterate through the array
        running += nums[i]; // Update running sum
        int rem = k == 0 ? running : running % k; // Compute modulo (handling k=0 edge case if applicable)
        if (firstIndex.containsKey(rem)) { // If we've seen this remainder before
            if (i - firstIndex.get(rem) >= 2) return true; // Ensure the subarray length is at least 2 before returning true
        } else {
            firstIndex.put(rem, i); // If this is a new remainder, store its first occurrence index
        }
    }
    return false; // Return false if no valid subarray is found
}
```

### Range Sum Query — Immutable

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Range Sum Query — Immutable](https://leetcode.com/problems/range-sum-query-immutable/)


Given an integer array `nums`, handle multiple queries of the following type:

<ol>
	- Calculate the **sum** of the elements of `nums` between indices `left` and `right` **inclusive** where `left <= right`.

</ol>

Implement the `NumArray` class:

	- `NumArray(int[] nums)` Initializes the object with the integer array `nums`.

	- `int sumRange(int left, int right)` Returns the **sum** of the elements of `nums` between indices `left` and `right` **inclusive** (i.e. `nums[left] + nums[left + 1] + ... + nums[right]`).

 

<strong class="example">Example 1:</strong>

```text

**Input**
["NumArray", "sumRange", "sumRange", "sumRange"]
[[[-2, 0, 3, -5, 2, -1]], [0, 2], [2, 5], [0, 5]]
**Output**
[null, 1, -1, -3]

**Explanation**
NumArray numArray = new NumArray([-2, 0, 3, -5, 2, -1]);
numArray.sumRange(0, 2); // return (-2) + 0 + 3 = 1
numArray.sumRange(2, 5); // return 3 + (-5) + 2 + (-1) = -1
numArray.sumRange(0, 5); // return (-2) + 0 + 3 + (-5) + 2 + (-1) = -3

```

 

**Constraints:**

	- `1 <= nums.length <= 10<sup>4</sup>`

	- `-10<sup>5</sup> <= nums[i] <= 10<sup>5</sup>`

	- `0 <= left <= right < nums.length`

	- At most `10<sup>4</sup>` calls will be made to `sumRange`.

</details>

**Category:** Tier 3 · Reference
**Pattern:** Prefix sum (precompute once)  **Time:** O(n) build, O(1) query  **Space:** O(n)
**Approach:** Precompute a prefix array where `prefix[i]` is the sum of the first `i` elements. Any `sumRange(l, r)` is then `prefix[r+1] - prefix[l]`, answered in constant time regardless of how many queries arrive.


```java
class NumArray {
    private final int[] prefix; // Array to store prefix sums permanently for the object
    public NumArray(int[] nums) { // Constructor to initialize the prefix sum array
        prefix = new int[nums.length + 1]; // Size is n+1 to make 0-indexed range sums easier
        for (int i = 0; i < nums.length; i++) prefix[i + 1] = prefix[i] + nums[i]; // Precompute prefix sum where prefix[i+1] is sum of first i elements
    }
    public int sumRange(int left, int right) { // Method to query the sum of a range
        return prefix[right + 1] - prefix[left]; // Return the range sum in O(1) time using subtraction
    }
}
```

### Difference Array (Range Updates)

<!-- Problem Statement not automatically found -->

**Category:** Tier 3 · Reference
**Pattern:** Difference array (inverse of prefix sum)  **Time:** O(n + q) for q updates  **Space:** O(n)
**Approach:** To apply many `add val to [l, r]` updates cheaply, record only the boundaries: `diff[l] += val` and `diff[r+1] -= val`. After all updates, a single prefix-sum pass over `diff` reconstructs the final array. Each range update is O(1) instead of O(r-l).


```java
public int[] applyRangeUpdates(int n, int[][] updates) {
    int[] diff = new int[n + 1]; // Difference array to store boundary updates, size n+1 to handle out-of-bounds right edge gracefully
    for (int[] u : updates) {           // u = {l, r, val} // Process each range update query
        diff[u[0]] += u[2]; // Add value to the starting boundary
        diff[u[1] + 1] -= u[2]; // Subtract value just past the ending boundary
    }
    int[] res = new int[n]; // Result array to hold the fully updated values
    int running = 0; // Variable to accumulate the differences
    for (int i = 0; i < n; i++) { // Sweep through the difference array to reconstruct the final values
        running += diff[i]; // Update the running sum with the current difference
        res[i] = running; // Assign the reconstructed value to the result array
    }
    return res; // Return the completely updated array
}
```

---

## 6. Kadane's Algorithm

**When to use / how to recognize it:** You want the best contiguous subarray under a running objective (max sum, max product). Carry the best result *ending at the current index*; at each step decide whether to extend the previous run or restart from the current element. O(n), O(1).

**Template:**
```java
int curr = arr[0], best = arr[0]; // Initialize current running optimal and global best with the first element
for (int i = 1; i < arr.length; i++) { // Iterate through the array starting from the second element
    curr = Math.max(arr[i], curr + arr[i]); // extend or restart // Decide to either start a new subarray here or extend the previous one
    best = Math.max(best, curr); // Update the global best if the current running optimal is better
}
```

### Maximum Subarray

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Maximum Subarray](https://leetcode.com/problems/maximum-subarray/)


Given an integer array `nums`, find the <span data-keyword="subarray-nonempty">subarray</span> with the largest sum, and return *its sum*.

 

<strong class="example">Example 1:</strong>

```text

**Input:** nums = [-2,1,-3,4,-1,2,1,-5,4]
**Output:** 6
**Explanation:** The subarray [4,-1,2,1] has the largest sum 6.

```

<strong class="example">Example 2:</strong>

```text

**Input:** nums = [1]
**Output:** 1
**Explanation:** The subarray [1] has the largest sum 1.

```

<strong class="example">Example 3:</strong>

```text

**Input:** nums = [5,4,-1,7,8]
**Output:** 23
**Explanation:** The subarray [5,4,-1,7,8] has the largest sum 23.

```

 

**Constraints:**

	- `1 <= nums.length <= 10<sup>5</sup>`

	- `-10<sup>4</sup> <= nums[i] <= 10<sup>4</sup>`

 

**Follow up:** If you have figured out the `O(n)` solution, try coding another solution using the **divide and conquer** approach, which is more subtle.

</details>

**Category:** ⭐ Tier 1 · Core
**Pattern:** Kadane  **Time:** O(n)  **Space:** O(1)
**Approach:** `curr` holds the maximum subarray sum ending at the current index: either start fresh at `nums[i]` or extend the previous run. A negative running sum can only hurt, so we drop it by restarting. Track the global best across all positions.


```java
public int maxSubArray(int[] nums) {
    int curr = nums[0], best = nums[0]; // Initialize current running max and overall best max using the first element
    for (int i = 1; i < nums.length; i++) { // Traverse the array starting from index 1
        curr = Math.max(nums[i], curr + nums[i]); // If adding the current element to previous sum is worse than the element itself, restart the sum from here
        best = Math.max(best, curr); // Keep track of the maximum sum seen across all positions
    }
    return best; // Return the overall maximum subarray sum
}
```

### Maximum Product Subarray

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Maximum Product Subarray](https://leetcode.com/problems/maximum-product-subarray/)


Given an integer array `nums`, find a <span data-keyword="subarray-nonempty">subarray</span> that has the largest product, and return *the product*.

The test cases are generated so that the answer will fit in a **32-bit** integer.

**Note** that the product of an array with a single element is the value of that element.

 

<strong class="example">Example 1:</strong>

```text

**Input:** nums = [2,3,-2,4]
**Output:** 6
**Explanation:** [2,3] has the largest product 6.

```

<strong class="example">Example 2:</strong>

```text

**Input:** nums = [-2,0,-1]
**Output:** 0
**Explanation:** The result cannot be 2, because [-2,-1] is not a subarray.

```

 

**Constraints:**

	- `1 <= nums.length <= 2 * 10<sup>4</sup>`

	- `-10 <= nums[i] <= 10`

	- The product of any subarray of `nums` is **guaranteed** to fit in a **32-bit** integer.

</details>

**Category:** Tier 2 · Reinforce
**Pattern:** Kadane variant (track min and max)  **Time:** O(n)  **Space:** O(1)
**Approach:** Products flip sign, so a large negative can become the best after multiplying by another negative. Track both the running max and running min ending here; on a negative element, swap them before updating. The answer is the largest running max seen.


```java
public int maxProduct(int[] nums) {
    int maxEnding = nums[0], minEnding = nums[0], best = nums[0]; // Track running max product, running min product (for negatives), and global best
    for (int i = 1; i < nums.length; i++) { // Iterate through the array starting from the second element
        if (nums[i] < 0) { // If the current element is negative, min and max products swap roles
            int t = maxEnding; maxEnding = minEnding; minEnding = t; // Swap maxEnding and minEnding
        }
        maxEnding = Math.max(nums[i], maxEnding * nums[i]); // Update the maximum product ending at the current index
        minEnding = Math.min(nums[i], minEnding * nums[i]); // Update the minimum product ending at the current index
        best = Math.max(best, maxEnding); // Update the overall best product
    }
    return best; // Return the maximum product contiguous subarray
}
```

---

## 7. Cyclic Sort

**When to use / how to recognize it:** The array holds `n` numbers drawn from a contiguous range like `[0, n]` or `[1, n]`, and you must find missing/duplicate/misplaced values in O(n) time, O(1) space. The trick: each value `v` has a natural home index (`v` or `v-1`); repeatedly swap values to their homes, then scan for slots that don't match.

**Template:**
```java
int i = 0; // Start at the first element
while (i < nums.length) { // Loop until the entire array has been processed
    int home = nums[i] - 1;            // target index for nums[i] (1..n) // Determine where the current value SHOULD be placed
    if (nums[i] > 0 && nums[i] <= nums.length && nums[i] != nums[home]) { // Check if the value is in range and not already at its correct home
        int t = nums[i]; nums[i] = nums[home]; nums[home] = t; // swap home // Swap the value to its rightful home index
    } else {
        i++; // Move to the next element if the current one is out of bounds, or already in its correct place
    }
}
// now scan: any index where nums[i] != i+1 is anomalous // After sorting, a linear pass can find missing/duplicate items
```

### Missing Number

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Missing Number](https://leetcode.com/problems/missing-number/)


Given an array `nums` containing `n` distinct numbers in the range `[0, n]`, return *the only number in the range that is missing from the array.*

 

<strong class="example">Example 1:</strong>

<div class="example-block">

**Input:** <span class="example-io">nums = [3,0,1]</span>

**Output:** <span class="example-io">2</span>

**Explanation:**

`n = 3` since there are 3 numbers, so all numbers are in the range `[0,3]`. 2 is the missing number in the range since it does not appear in `nums`.
</div>

<strong class="example">Example 2:</strong>

<div class="example-block">

**Input:** <span class="example-io">nums = [0,1]</span>

**Output:** <span class="example-io">2</span>

**Explanation:**

`n = 2` since there are 2 numbers, so all numbers are in the range `[0,2]`. 2 is the missing number in the range since it does not appear in `nums`.
</div>

<strong class="example">Example 3:</strong>

<div class="example-block">

**Input:** <span class="example-io">nums = [9,6,4,2,3,5,7,0,1]</span>

**Output:** <span class="example-io">8</span>

**Explanation:**

`n = 9` since there are 9 numbers, so all numbers are in the range `[0,9]`. 8 is the missing number in the range since it does not appear in `nums`.
</div>

<div class="simple-translate-system-theme" id="simple-translate">
<div>
<div class="simple-translate-button isShow" style="background-image: url("moz-extension://8a9ffb6b-7e69-4e93-aae1-436a1448eff6/icons/512.png"); height: 22px; width: 22px; top: 318px; left: 36px;"> </div>

<div class="simple-translate-panel " style="width: 300px; height: 200px; top: 0px; left: 0px; font-size: 13px;">
<div class="simple-translate-result-wrapper" style="overflow: hidden;">
<div class="simple-translate-move" draggable="true"> </div>

<div class="simple-translate-result-contents">
<p class="simple-translate-result" dir="auto"> 

<p class="simple-translate-candidate" dir="auto"> 
</div>
</div>
</div>
</div>
</div>

 

**Constraints:**

	- `n == nums.length`

	- `1 <= n <= 10<sup>4</sup>`

	- `0 <= nums[i] <= n`

	- All the numbers of `nums` are **unique**.

 

**Follow up:** Could you implement a solution using only `O(1)` extra space complexity and `O(n)` runtime complexity?

</details>

**Category:** ⭐ Tier 1 · Core
**Pattern:** Cyclic sort (range [0, n])  **Time:** O(n)  **Space:** O(1)
**Approach:** Values are `0..n` with one missing, so value `v` belongs at index `v`. Place each in-range value at its home index. After sorting, the first index whose value doesn't equal the index is the missing number; if all match, the missing one is `n`.


```java
public int missingNumber(int[] nums) {
    int n = nums.length, i = 0; // Length of array is n, target range is [0, n]
    while (i < n) { // Traverse the array for cyclic sort
        if (nums[i] < n && nums[i] != i) { // If value is in bounds and not at its correct home index
            int t = nums[i]; nums[i] = nums[nums[i]]; nums[t] = t; // Swap the value to its correct home index (nums[i] should be at index nums[i])
        } else {
            i++; // Move to the next index if current is correctly placed or is the value 'n'
        }
    }
    for (int j = 0; j < n; j++) if (nums[j] != j) return j; // Scan the array, first mismatched index is the missing number
    return n; // If all indices match their values, the missing number must be 'n'
}
```

**Alternative (XOR / sum, no mutation):** XOR all indices `0..n` with all values; pairs cancel, leaving the missing number. O(n) time, O(1) space, non-destructive.

```java
public int missingNumberXor(int[] nums) {
    int x = nums.length; // Start with 'n' because the loop XORs indices 0 to n-1
    for (int i = 0; i < nums.length; i++) x ^= i ^ nums[i]; // XOR running result with index and value. Pairs cancel out.
    return x; // The only uncancelled value remaining is the missing number
}
```

### Find All Duplicates in an Array

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Find All Duplicates in an Array](https://leetcode.com/problems/find-all-duplicates-in-an-array/)


Given an integer array `nums` of length `n` where all the integers of `nums` are in the range `[1, n]` and each integer appears **at most** **twice**, return *an array of all the integers that appears **twice***.

You must write an algorithm that runs in `O(n)` time and uses only *constant* auxiliary space, excluding the space needed to store the output

 

<strong class="example">Example 1:</strong>

```text
**Input:** nums = [4,3,2,7,8,2,3,1]
**Output:** [2,3]

```

<strong class="example">Example 2:</strong>

```text
**Input:** nums = [1,1,2]
**Output:** [1]

```

<strong class="example">Example 3:</strong>

```text
**Input:** nums = [1]
**Output:** []

```

 

**Constraints:**

	- `n == nums.length`

	- `1 <= n <= 10<sup>5</sup>`

	- `1 <= nums[i] <= n`

	- Each element in `nums` appears **once** or **twice**.

</details>

**Category:** Tier 3 · Reference
**Pattern:** Cyclic sort (range [1, n], each appears once or twice)  **Time:** O(n)  **Space:** O(1)
**Approach:** Value `v` belongs at index `v-1`. Cyclic-sort everything home; afterward any index `i` whose value isn't `i+1` is holding a duplicate (its true home was already occupied by the other copy). Collect those values.


```java
public List<Integer> findDuplicates(int[] nums) {
    int i = 0; // Start at the first element
    while (i < nums.length) { // Cyclic sort the array
        int home = nums[i] - 1; // Calculate the target home index for the current value (1-indexed array mapped to 0-indexed)
        if (nums[i] != nums[home]) { // If the current value is not already at its target home
            int t = nums[i]; nums[i] = nums[home]; nums[home] = t; // Swap it to its home
        } else {
            i++; // Otherwise, advance to the next element
        }
    }
    List<Integer> res = new ArrayList<>(); // Prepare the result list
    for (int j = 0; j < nums.length; j++) { // Scan through the array
        if (nums[j] != j + 1) res.add(nums[j]); // If an element is not at its correct 1-indexed home, it's a duplicate
    }
    return res; // Return the list of duplicates found
}
```

**Alternative (sign marking, no swaps):** Treat the value at index `|v|-1` as a visit flag: negate it on first visit; if it's already negative, `v` is a duplicate. Restores nothing but is concise and O(n)/O(1).

```java
public List<Integer> findDuplicatesSign(int[] nums) {
    List<Integer> res = new ArrayList<>(); // Result list for duplicate numbers
    for (int x : nums) { // Iterate through each element in the array
        int idx = Math.abs(x) - 1; // Map the absolute value to a 0-based index
        if (nums[idx] < 0) res.add(idx + 1); // If the value at this mapped index is already negative, we've seen this number before
        else nums[idx] = -nums[idx]; // Otherwise, mark this number as seen by negating the value at its mapped index
    }
    return res; // Return the duplicates
}
```

### First Missing Positive

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [First Missing Positive](https://leetcode.com/problems/first-missing-positive/)


Given an unsorted integer array `nums`. Return the *smallest positive integer* that is *not present* in `nums`.

You must implement an algorithm that runs in `O(n)` time and uses `O(1)` auxiliary space.

 

<strong class="example">Example 1:</strong>

```text

**Input:** nums = [1,2,0]
**Output:** 3
**Explanation:** The numbers in the range [1,2] are all in the array.

```

<strong class="example">Example 2:</strong>

```text

**Input:** nums = [3,4,-1,1]
**Output:** 2
**Explanation:** 1 is in the array but 2 is missing.

```

<strong class="example">Example 3:</strong>

```text

**Input:** nums = [7,8,9,11,12]
**Output:** 1
**Explanation:** The smallest positive integer 1 is missing.

```

 

**Constraints:**

	- `1 <= nums.length <= 10<sup>5</sup>`

	- `-2<sup>31</sup> <= nums[i] <= 2<sup>31</sup> - 1`

</details>

**Category:** Tier 2 · Reinforce
**Pattern:** Cyclic sort (range [1, n])  **Time:** O(n)  **Space:** O(1)
**Approach:** Only values in `1..n` can be the answer; place each such value at index `v-1`, ignoring out-of-range and duplicates. After placement, the first index `i` where `nums[i] != i+1` gives the missing positive `i+1`; if all are in place, the answer is `n+1`.


```java
public int firstMissingPositive(int[] nums) {
    int n = nums.length, i = 0; // Get length and initialize index
    while (i < n) { // Cyclic sort to place positive integers at their natural indices
        int home = nums[i] - 1; // Target index for value v is v-1
        if (nums[i] > 0 && nums[i] <= n && nums[i] != nums[home]) { // Only care about values in [1, n] that aren't home
            int t = nums[i]; nums[i] = nums[home]; nums[home] = t; // Swap the current value to its rightful place
        } else {
            i++; // Skip out-of-bounds numbers, duplicates, or correctly placed numbers
        }
    }
    for (int j = 0; j < n; j++) if (nums[j] != j + 1) return j + 1; // Scan for the first index j that does not contain j+1
    return n + 1; // If all 1 to n are present, the first missing positive is n+1
}
```

### Find the Duplicate Number

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Find the Duplicate Number](https://leetcode.com/problems/find-the-duplicate-number/)


Given an array of integers `nums` containing `n + 1` integers where each integer is in the range `[1, n]` inclusive.

There is only **one repeated number** in `nums`, return *this repeated number*.

You must solve the problem **without** modifying the array `nums` and using only constant extra space.

 

<strong class="example">Example 1:</strong>

```text

**Input:** nums = [1,3,4,2,2]
**Output:** 2

```

<strong class="example">Example 2:</strong>

```text

**Input:** nums = [3,1,3,4,2]
**Output:** 3

```

<strong class="example">Example 3:</strong>

```text

**Input:** nums = [3,3,3,3,3]
**Output:** 3
```

 

**Constraints:**

	- `1 <= n <= 10<sup>5</sup>`

	- `nums.length == n + 1`

	- `1 <= nums[i] <= n`

	- All the integers in `nums` appear only **once** except for **precisely one integer** which appears **two or more** times.

 

**Follow up:**

	- How can we prove that at least one duplicate number must exist in `nums`?

	- Can you solve the problem in linear runtime complexity?

</details>

**Category:** Tier 3 · Reference
**Pattern:** Floyd's cycle detection (read-only)  **Time:** O(n)  **Space:** O(1)
**Approach:** With `n+1` values in `1..n`, treating `nums[i]` as a "next" pointer creates a linked list with a cycle whose entrance is the duplicate. Phase 1 finds a meeting point with fast/slow pointers; phase 2 walks one pointer from the start and one from the meeting point at equal speed — they meet at the cycle entrance, the duplicate. Does not modify the array.


```java
public int findDuplicate(int[] nums) {
    int slow = nums[0], fast = nums[0]; // Initialize slow and fast pointers for cycle detection
    do { // Phase 1: Finding the intersection point in the cycle
        slow = nums[slow]; // Move slow pointer one step
        fast = nums[nums[fast]]; // Move fast pointer two steps
    } while (slow != fast); // Loop until they meet
    slow = nums[0]; // Phase 2: Find the entrance to the cycle (the duplicate number)
    while (slow != fast) { // Move both pointers one step at a time
        slow = nums[slow]; // Move slow pointer
        fast = nums[fast]; // Move fast pointer
    }
    return slow; // The meeting point is the start of the cycle, which is the duplicate number
}
```

**Alternative (cyclic sort, mutating):** If mutation is allowed, swap values home as in the templates; the first value found already sitting at an occupied home is the duplicate. O(n)/O(1) but destroys the input.
