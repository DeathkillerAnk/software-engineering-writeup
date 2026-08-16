# 03 · Linked Lists, Stacks, Queues & Intervals

Patterns and idiomatic Java for linked-list manipulation, stack/queue design, monotonic stacks/deques, and interval merging.

```java
class ListNode {
    int val; // Store the node's integer value
    ListNode next; // Pointer to the next node in the linked list
    ListNode() {} // Default constructor for dummy nodes or empty initialization
    ListNode(int val) { this.val = val; } // Constructor to initialize a node with a specific value
    ListNode(int val, ListNode next) { this.val = val; this.next = next; } // Constructor to initialize both value and next pointer
}
```

---

## Linked List — Fast / Slow Pointers

### Linked List Cycle I
**Category:** Tier 2 · Reinforce
**Pattern:** Floyd's cycle detection  **Time:** O(n)  **Space:** O(1)
**Approach:** Advance a slow pointer one step and a fast pointer two steps per iteration. If a cycle exists, the fast pointer eventually laps the slow one and they meet inside the loop. If fast reaches null, the list is acyclic.

<!-- Problem Statement not automatically found -->

```java
public boolean hasCycle(ListNode head) {
    ListNode slow = head, fast = head; // Initialize both slow and fast pointers at the head of the list
    while (fast != null && fast.next != null) { // Continue while fast pointer and its next node are not null (prevents NullPointerException)
        slow = slow.next; // Move slow pointer one step forward
        fast = fast.next.next; // Move fast pointer two steps forward
        if (slow == fast) return true; // If slow and fast meet, a cycle exists in the linked list
    }
    return false; // If the loop terminates, the fast pointer reached the end of the list, so no cycle exists
}
```

### Linked List Cycle II (find start)
**Category:** ⭐ Tier 1 · Core
**Pattern:** Floyd's cycle detection + math  **Time:** O(n)  **Space:** O(1)
**Approach:** First detect the meeting point with slow/fast. The distance from head to the cycle start equals the distance from the meeting point to the cycle start (mod cycle length). Reset one pointer to head and advance both one step at a time; they meet at the cycle entrance.

<!-- Problem Statement not automatically found -->

```java
public ListNode detectCycle(ListNode head) {
    ListNode slow = head, fast = head; // Initialize both pointers at the head of the list
    while (fast != null && fast.next != null) { // Traverse the list, fast moving twice as fast
        slow = slow.next; // Move slow pointer by 1 step
        fast = fast.next.next; // Move fast pointer by 2 steps
        if (slow == fast) { // A cycle is detected when they intersect
            ListNode p = head; // Start a new pointer p from the head of the list
            while (p != slow) { // Move both p and slow one step at a time
                p = p.next; // Advance p by 1 step
                slow = slow.next; // Advance slow by 1 step; they will meet at the start of the cycle
            }
            return p; // Return the node where they meet, which is the start of the cycle
        }
    }
    return null; // If loop ends, there's no cycle, return null
}
```

### Middle of the Linked List
**Category:** Tier 3 · Reference
**Pattern:** Fast / slow pointers  **Time:** O(n)  **Space:** O(1)
**Approach:** Move slow one step and fast two steps. When fast reaches the end, slow is at the middle. For even length this returns the second of the two middle nodes (standard LeetCode convention).

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Middle of the Linked List](https://leetcode.com/problems/middle-of-the-linked-list/)


Given the `head` of a singly linked list, return *the middle node of the linked list*.

If there are two middle nodes, return **the second middle** node.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2021/07/23/lc-midlist1.jpg" style="width: 544px; height: 65px;" />

```text

**Input:** head = [1,2,3,4,5]
**Output:** [3,4,5]
**Explanation:** The middle node of the list is node 3.

```

<strong class="example">Example 2:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2021/07/23/lc-midlist2.jpg" style="width: 664px; height: 65px;" />

```text

**Input:** head = [1,2,3,4,5,6]
**Output:** [4,5,6]
**Explanation:** Since the list has two middle nodes with values 3 and 4, we return the second one.

```

 

**Constraints:**

	- The number of nodes in the list is in the range `[1, 100]`.

	- `1 <= Node.val <= 100`

</details>

```java
public ListNode middleNode(ListNode head) {
    ListNode slow = head, fast = head; // Start both pointers at the head
    while (fast != null && fast.next != null) { // Loop until fast reaches the end
        slow = slow.next; // Move slow pointer 1 step
        fast = fast.next.next; // Move fast pointer 2 steps
    }
    return slow; // When fast is at the end, slow will be exactly at the middle node
}
```

### Palindrome Linked List
**Category:** Tier 2 · Reinforce
**Pattern:** Fast/slow + reversal  **Time:** O(n)  **Space:** O(1)
**Approach:** Find the middle with slow/fast, reverse the second half in place, then compare it node-by-node against the first half. This avoids the O(n) space of copying values into an array. Optionally restore the list by reversing the second half back.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Palindrome Linked List](https://leetcode.com/problems/palindrome-linked-list/)


Given the `head` of a singly linked list, return `true`* if it is a *<span data-keyword="palindrome-sequence">*palindrome*</span>* or *`false`* otherwise*.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2021/03/03/pal1linked-list.jpg" style="width: 422px; height: 62px;" />

```text

**Input:** head = [1,2,2,1]
**Output:** true

```

<strong class="example">Example 2:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2021/03/03/pal2linked-list.jpg" style="width: 182px; height: 62px;" />

```text

**Input:** head = [1,2]
**Output:** false

```

 

**Constraints:**

	- The number of nodes in the list is in the range `[1, 10<sup>5</sup>]`.

	- `0 <= Node.val <= 9`

 
**Follow up:** Could you do it in `O(n)` time and `O(1)` space?

</details>

```java
public boolean isPalindrome(ListNode head) {
    ListNode slow = head, fast = head; // Initialize slow and fast pointers to find the middle
    while (fast != null && fast.next != null) { // Traverse to locate the middle of the linked list
        slow = slow.next; // Advance slow by 1
        fast = fast.next.next; // Advance fast by 2
    }
    ListNode second = reverse(slow); // Reverse the second half of the list starting from the middle
    ListNode p1 = head, p2 = second; // p1 points to the start, p2 points to the reversed second half
    boolean ok = true; // Flag to store the palindrome result
    while (p2 != null) { // Iterate through the reversed second half
        if (p1.val != p2.val) { ok = false; break; } // If values don't match, it's not a palindrome
        p1 = p1.next; // Move p1 forward
        p2 = p2.next; // Move p2 forward
    }
    return ok; // Return the result (could optionally reverse the second half back to its original state here)
}

private ListNode reverse(ListNode node) {
    ListNode prev = null; // prev starts as null, will become the new tail
    while (node != null) { // Traverse the list to reverse it
        ListNode next = node.next; // Save the next node temporarily
        node.next = prev; // Reverse the link to point to the previous node
        prev = node; // Move prev forward to the current node
        node = next; // Move current node forward to the saved next node
    }
    return prev; // Return prev, which is the new head of the reversed list
}
```
**Alternative:** Push all values to an array/deque and two-pointer compare — O(n) space but simpler.

---

## Linked List — Reversal

### Reverse Linked List
**Category:** ⭐ Tier 1 · Core
**Pattern:** Pointer reversal  **Time:** O(n)  **Space:** O(1) iterative / O(n) recursive
**Approach:** Iteratively walk the list keeping a `prev` pointer; redirect each node's `next` to `prev` before advancing. The recursive version reverses the tail first, then fixes the link so the next node points back to the current one.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Reverse Linked List](https://leetcode.com/problems/reverse-linked-list/)


Given the `head` of a singly linked list, reverse the list, and return *the reversed list*.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2021/02/19/rev1ex1.jpg" style="width: 542px; height: 222px;" />

```text

**Input:** head = [1,2,3,4,5]
**Output:** [5,4,3,2,1]

```

<strong class="example">Example 2:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2021/02/19/rev1ex2.jpg" style="width: 182px; height: 222px;" />

```text

**Input:** head = [1,2]
**Output:** [2,1]

```

<strong class="example">Example 3:</strong>

```text

**Input:** head = []
**Output:** []

```

 

**Constraints:**

	- The number of nodes in the list is the range `[0, 5000]`.

	- `-5000 <= Node.val <= 5000`

 

**Follow up:** A linked list can be reversed either iteratively or recursively. Could you implement both?

</details>

```java
// Iterative
public ListNode reverseList(ListNode head) {
    ListNode prev = null; // prev starts as null; it will eventually become the new head
    while (head != null) { // Iterate through the list until the end
        ListNode next = head.next; // Temporarily store the next node
        head.next = prev; // Reverse the current node's pointer to point to the previous node
        prev = head; // Move prev pointer forward to the current node
        head = next; // Move head pointer forward to the next node in the original list
    }
    return prev; // prev is now the new head of the reversed list
}

// Recursive
public ListNode reverseListRec(ListNode head) {
    if (head == null || head.next == null) return head; // Base case: empty list or single node is already reversed
    ListNode newHead = reverseListRec(head.next); // Recursively reverse the rest of the list
    head.next.next = head; // Make the next node point back to the current node (reverse the link)
    head.next = null; // Clear the current node's next pointer to prevent cycles
    return newHead; // Return the new head from the deepest recursive call
}
```

### Reverse Linked List II (between m..n)
**Category:** Tier 3 · Reference
**Pattern:** Pointer reversal with dummy head  **Time:** O(n)  **Space:** O(1)
**Approach:** Use a dummy node to handle reversal starting at the head. Advance to the node before position `left`, then repeatedly splice the node after the current "tail of reversed segment" to the front of that segment (head-insertion). After `right - left` splices the sublist is reversed in place.

<!-- Problem Statement not automatically found -->

```java
public ListNode reverseBetween(ListNode head, int left, int right) {
    ListNode dummy = new ListNode(0, head); // Dummy node simplifies cases where head itself changes
    ListNode prev = dummy; // prev will eventually point to the node right before the reversed sublist
    for (int i = 0; i < left - 1; i++) prev = prev.next; // Advance prev to the node just before index 'left'
    ListNode cur = prev.next; // cur is the first node of the sublist to be reversed (it will become the sublist's tail)
    for (int i = 0; i < right - left; i++) { // Loop exactly 'right - left' times to reverse the sublist
        ListNode next = cur.next; // 'next' is the node to be moved to the front of the reversed segment
        cur.next = next.next; // Detach 'next' from the list by linking 'cur' to the node after 'next'
        next.next = prev.next; // Insert 'next' at the front of the reversed segment
        prev.next = next; // Update prev to point to the newly moved 'next' node
    }
    return dummy.next; // Return the head of the modified list
}
```

### Reverse Nodes in k-Group
**Category:** ⭐ Tier 1 · Core
**Pattern:** Segmented reversal  **Time:** O(n)  **Space:** O(1)
**Approach:** Walk the list checking whether at least k nodes remain. If so, reverse that block of k using standard pointer reversal, then connect the previous group's tail to the new head and continue. Remaining nodes fewer than k are left untouched.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Reverse Nodes in k-Group](https://leetcode.com/problems/reverse-nodes-in-k-group/)


Given the `head` of a linked list, reverse the nodes of the list `k` at a time, and return *the modified list*.

`k` is a positive integer and is less than or equal to the length of the linked list. If the number of nodes is not a multiple of `k` then left-out nodes, in the end, should remain as it is.

You may not alter the values in the list's nodes, only nodes themselves may be changed.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2020/10/03/reverse_ex1.jpg" style="width: 542px; height: 222px;" />

```text

**Input:** head = [1,2,3,4,5], k = 2
**Output:** [2,1,4,3,5]

```

<strong class="example">Example 2:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2020/10/03/reverse_ex2.jpg" style="width: 542px; height: 222px;" />

```text

**Input:** head = [1,2,3,4,5], k = 3
**Output:** [3,2,1,4,5]

```

 

**Constraints:**

	- The number of nodes in the list is `n`.

	- `1 <= k <= n <= 5000`

	- `0 <= Node.val <= 1000`

 

**Follow-up:** Can you solve the problem in `O(1)` extra memory space?

</details>

```java
public ListNode reverseKGroup(ListNode head, int k) {
    ListNode dummy = new ListNode(0, head); // Use dummy node to handle head modification gracefully
    ListNode groupPrev = dummy; // Points to the node just before the current k-group
    while (true) { // Loop until we can no longer find a complete k-group
        ListNode kth = groupPrev; // kth will find the last node in the current k-group
        for (int i = 0; i < k && kth != null; i++) kth = kth.next; // Advance kth by k steps
        if (kth == null) break; // If fewer than k nodes remain, we are done
        ListNode groupNext = kth.next; // Store the first node of the next group
        ListNode prev = groupNext, cur = groupPrev.next; // Initialize pointers to reverse the current k-group
        while (cur != groupNext) { // Reverse nodes until we reach the start of the next group
            ListNode next = cur.next; // Temporarily store the next node
            cur.next = prev; // Reverse the link
            prev = cur; // Move prev forward
            cur = next; // Move cur forward
        }
        ListNode newTail = groupPrev.next; // The original first node of the group is now its tail
        groupPrev.next = kth; // Link the previous part of the list to the new head of the reversed group
        groupPrev = newTail; // Move groupPrev to the end of the newly reversed group for the next iteration
    }
    return dummy.next; // Return the actual head of the resulting list
}
```

### Swap Nodes in Pairs
**Category:** Tier 3 · Reference
**Pattern:** Pointer manipulation with dummy  **Time:** O(n)  **Space:** O(1)
**Approach:** With a dummy head, repeatedly take two consecutive nodes and rewire `prev -> second -> first -> rest`. Advance `prev` to the node now in the second position and continue until fewer than two nodes remain.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Swap Nodes in Pairs](https://leetcode.com/problems/swap-nodes-in-pairs/)


Given a linked list, swap every two adjacent nodes and return its head. You must solve the problem without modifying the values in the list's nodes (i.e., only nodes themselves may be changed.)

 

<strong class="example">Example 1:</strong>

<div class="example-block">

**Input:** <span class="example-io">head = [1,2,3,4]</span>

**Output:** <span class="example-io">[2,1,4,3]</span>

**Explanation:**

<img alt="" src="https://assets.leetcode.com/uploads/2020/10/03/swap_ex1.jpg" style="width: 422px; height: 222px;" />
</div>

<strong class="example">Example 2:</strong>

<div class="example-block">

**Input:** <span class="example-io">head = []</span>

**Output:** <span class="example-io">[]</span>
</div>

<strong class="example">Example 3:</strong>

<div class="example-block">

**Input:** <span class="example-io">head = [1]</span>

**Output:** <span class="example-io">[1]</span>
</div>

<strong class="example">Example 4:</strong>

<div class="example-block">

**Input:** <span class="example-io">head = [1,2,3]</span>

**Output:** <span class="example-io">[2,1,3]</span>
</div>

 

**Constraints:**

	- The number of nodes in the list is in the range `[0, 100]`.

	- `0 <= Node.val <= 100`

</details>

```java
public ListNode swapPairs(ListNode head) {
    ListNode dummy = new ListNode(0, head); // Dummy node simplifies handling the new head
    ListNode prev = dummy; // prev tracks the node preceding the pair being swapped
    while (prev.next != null && prev.next.next != null) { // Loop while there is at least a pair left to swap
        ListNode first = prev.next; // First node of the pair
        ListNode second = first.next; // Second node of the pair
        first.next = second.next; // Link first node to the rest of the list
        second.next = first; // Link second node back to first, completing the swap
        prev.next = second; // Link the previous part of the list to the new first node (formerly second)
        prev = first; // Advance prev to the end of the swapped pair
    }
    return dummy.next; // Return the new head, skipping the dummy node
}
```

### Rotate List
**Category:** Tier 3 · Reference
**Pattern:** Cycle + cut  **Time:** O(n)  **Space:** O(1)
**Approach:** Count the length and connect the tail to the head to form a ring. The new tail sits at index `len - k % len - 1`; walk there, break the ring after it, and the node after becomes the new head. Take `k % len` to handle rotations larger than the list.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Rotate List](https://leetcode.com/problems/rotate-list/)


Given the `head` of a linked list, rotate the list to the right by `k` places.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2020/11/13/rotate1.jpg" style="width: 450px; height: 191px;" />

```text

**Input:** head = [1,2,3,4,5], k = 2
**Output:** [4,5,1,2,3]

```

<strong class="example">Example 2:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2020/11/13/roate2.jpg" style="width: 305px; height: 350px;" />

```text

**Input:** head = [0,1,2], k = 4
**Output:** [2,0,1]

```

 

**Constraints:**

	- The number of nodes in the list is in the range `[0, 500]`.

	- `-100 <= Node.val <= 100`

	- `0 <= k <= 2 * 10<sup>9</sup>`

</details>

```java
public ListNode rotateRight(ListNode head, int k) {
    if (head == null || head.next == null || k == 0) return head; // Base case: empty, single node, or no rotation
    int len = 1; // Variable to store list length
    ListNode tail = head; // Start tail at head
    while (tail.next != null) { tail = tail.next; len++; } // Traverse to find the tail node and compute length
    k %= len; // Effective rotations needed, since rotating by length returns the exact same list
    if (k == 0) return head; // If effective rotations is 0, no change is needed
    tail.next = head;                // close ring: connect tail to head to form a circular list
    ListNode newTail = head; // Use newTail to find the new end of the list
    for (int i = 0; i < len - k - 1; i++) newTail = newTail.next; // Move forward to the (len - k - 1)-th node
    ListNode newHead = newTail.next; // The new head is just after the new tail
    newTail.next = null; // Break the circle to finalize the rotated list
    return newHead; // Return the new head
}
```

---

## Linked List — Merge / Manipulate

### Merge Two Sorted Lists
**Category:** ⭐ Tier 1 · Core
**Pattern:** Two-pointer merge with dummy  **Time:** O(n + m)  **Space:** O(1)
**Approach:** Use a dummy head and a tail pointer. At each step append the smaller of the two current nodes and advance that list. When one list is exhausted, splice the remaining tail of the other directly.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Merge Two Sorted Lists](https://leetcode.com/problems/merge-two-sorted-lists/)


You are given the heads of two sorted linked lists `list1` and `list2`.

Merge the two lists into one **sorted** list. The list should be made by splicing together the nodes of the first two lists.

Return *the head of the merged linked list*.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2020/10/03/merge_ex1.jpg" style="width: 662px; height: 302px;" />

```text

**Input:** list1 = [1,2,4], list2 = [1,3,4]
**Output:** [1,1,2,3,4,4]

```

<strong class="example">Example 2:</strong>

```text

**Input:** list1 = [], list2 = []
**Output:** []

```

<strong class="example">Example 3:</strong>

```text

**Input:** list1 = [], list2 = [0]
**Output:** [0]

```

 

**Constraints:**

	- The number of nodes in both lists is in the range `[0, 50]`.

	- `-100 <= Node.val <= 100`

	- Both `list1` and `list2` are sorted in **non-decreasing** order.

</details>

```java
public ListNode mergeTwoLists(ListNode l1, ListNode l2) {
    ListNode dummy = new ListNode(0); // Dummy node simplifies the edge cases when merging
    ListNode tail = dummy; // Tail pointer tracks the end of the merged list
    while (l1 != null && l2 != null) { // Loop until we reach the end of either list
        if (l1.val <= l2.val) { // Compare values, prefer l1 if it's smaller or equal
            tail.next = l1; // Append l1's node to the merged list
            l1 = l1.next; // Advance l1 pointer
        } else {
            tail.next = l2; // Append l2's node to the merged list
            l2 = l2.next; // Advance l2 pointer
        }
        tail = tail.next; // Move the tail pointer forward to the newly added node
    }
    tail.next = (l1 != null) ? l1 : l2; // Splice the remaining elements of the non-empty list directly
    return dummy.next; // Return the head of the merged list, skipping the dummy node
}
```

### Add Two Numbers
**Category:** Tier 2 · Reinforce
**Pattern:** Digit-by-digit with carry  **Time:** O(max(n, m))  **Space:** O(max(n, m))
**Approach:** Digits are stored in reverse order, so traverse both lists simultaneously, summing corresponding digits plus a carry. Create a new node for each `sum % 10` and propagate `sum / 10`. Continue while either list remains or a carry is pending.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Add Two Numbers](https://leetcode.com/problems/add-two-numbers/)


You are given two **non-empty** linked lists representing two non-negative integers. The digits are stored in **reverse order**, and each of their nodes contains a single digit. Add the two numbers and return the sum as a linked list.

You may assume the two numbers do not contain any leading zero, except the number 0 itself.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2020/10/02/addtwonumber1.jpg" style="width: 483px; height: 342px;" />

```text

**Input:** l1 = [2,4,3], l2 = [5,6,4]
**Output:** [7,0,8]
**Explanation:** 342 + 465 = 807.

```

<strong class="example">Example 2:</strong>

```text

**Input:** l1 = [0], l2 = [0]
**Output:** [0]

```

<strong class="example">Example 3:</strong>

```text

**Input:** l1 = [9,9,9,9,9,9,9], l2 = [9,9,9,9]
**Output:** [8,9,9,9,0,0,0,1]

```

 

**Constraints:**

	- The number of nodes in each linked list is in the range `[1, 100]`.

	- `0 <= Node.val <= 9`

	- It is guaranteed that the list represents a number that does not have leading zeros.

</details>

```java
public ListNode addTwoNumbers(ListNode l1, ListNode l2) {
    ListNode dummy = new ListNode(0); // Dummy node to anchor the result list
    ListNode cur = dummy; // cur pointer builds the result list
    int carry = 0; // Carry tracks values >= 10 to add to the next significant digit
    while (l1 != null || l2 != null || carry != 0) { // Continue while digits remain or a carry is pending
        int sum = carry; // Start the sum with the previous carry
        if (l1 != null) { sum += l1.val; l1 = l1.next; } // Add l1's digit if available and move pointer
        if (l2 != null) { sum += l2.val; l2 = l2.next; } // Add l2's digit if available and move pointer
        carry = sum / 10; // Compute the new carry (either 0 or 1, since 9+9+1 = 19)
        cur.next = new ListNode(sum % 10); // Store the last digit of the sum in a new node
        cur = cur.next; // Move to the newly created node
    }
    return dummy.next; // Return the result list, skipping the dummy node
}
```

### Remove Nth Node From End
**Category:** ⭐ Tier 1 · Core
**Pattern:** Two-pointer gap  **Time:** O(n)  **Space:** O(1)
**Approach:** Advance a `fast` pointer n steps ahead of `slow` (both starting at a dummy). Then move both until `fast` reaches the last node; `slow` now sits just before the target, so unlink it. The dummy elegantly handles removing the head.

<!-- Problem Statement not automatically found -->

```java
public ListNode removeNthFromEnd(ListNode head, int n) {
    ListNode dummy = new ListNode(0, head); // Dummy node helps handle cases where the head is removed
    ListNode fast = dummy, slow = dummy; // Initialize two pointers at dummy
    for (int i = 0; i < n; i++) fast = fast.next; // Create a gap of n nodes between fast and slow
    while (fast.next != null) { // Move both pointers simultaneously until fast reaches the end
        fast = fast.next; // Move fast forward
        slow = slow.next; // Move slow forward; slow will eventually point to the node just before the target
    }
    slow.next = slow.next.next; // Unlink the nth node from the end by skipping over it
    return dummy.next; // Return the new head
}
```

### Reorder List
**Category:** Tier 2 · Reinforce
**Pattern:** Find middle + reverse + merge  **Time:** O(n)  **Space:** O(1)
**Approach:** Split the list at the middle, reverse the second half, then interleave the two halves node by node. This produces the pattern L0 -> Ln -> L1 -> Ln-1 -> ... without extra storage.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Reorder List](https://leetcode.com/problems/reorder-list/)


You are given the head of a singly linked-list. The list can be represented as:

```text

L<sub>0</sub> &rarr; L<sub>1</sub> &rarr; &hellip; &rarr; L<sub>n - 1</sub> &rarr; L<sub>n</sub>

```

*Reorder the list to be on the following form:*

```text

L<sub>0</sub> &rarr; L<sub>n</sub> &rarr; L<sub>1</sub> &rarr; L<sub>n - 1</sub> &rarr; L<sub>2</sub> &rarr; L<sub>n - 2</sub> &rarr; &hellip;

```

You may not modify the values in the list's nodes. Only nodes themselves may be changed.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2021/03/04/reorder1linked-list.jpg" style="width: 422px; height: 222px;" />

```text

**Input:** head = [1,2,3,4]
**Output:** [1,4,2,3]

```

<strong class="example">Example 2:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2021/03/09/reorder2-linked-list.jpg" style="width: 542px; height: 222px;" />

```text

**Input:** head = [1,2,3,4,5]
**Output:** [1,5,2,4,3]

```

 

**Constraints:**

	- The number of nodes in the list is in the range `[1, 5 * 10<sup>4</sup>]`.

	- `1 <= Node.val <= 1000`

</details>

```java
public void reorderList(ListNode head) {
    if (head == null || head.next == null) return; // Base case: lists of length 0 or 1 need no reordering
    ListNode slow = head, fast = head; // Use fast and slow pointers to find the middle of the list
    while (fast.next != null && fast.next.next != null) { // Traverse until fast reaches the end
        slow = slow.next; // slow advances by 1
        fast = fast.next.next; // fast advances by 2
    }
    ListNode second = slow.next; // 'second' points to the start of the second half of the list
    slow.next = null; // Disconnect the first half from the second half to avoid cycles
    ListNode prev = null; // prev will become the new head of the reversed second half
    while (second != null) { // Reverse the second half of the list in-place
        ListNode next = second.next; // Store the next node temporarily
        second.next = prev; // Reverse the link
        prev = second; // Move prev forward
        second = next; // Move second forward
    }
    ListNode first = head; // first points to the start of the first half
    while (prev != null) { // Interleave the first half and the reversed second half
        ListNode n1 = first.next, n2 = prev.next; // Store the next nodes for both halves temporarily
        first.next = prev; // Link node from the first half to node from the second half
        prev.next = n1; // Link node from the second half to the next node in the first half
        first = n1; // Move first pointer to the next node in the first half
        prev = n2; // Move prev pointer to the next node in the second half
    }
}
```

### Copy List with Random Pointer
**Category:** Tier 2 · Reinforce
**Pattern:** Interleaving / hashmap clone  **Time:** O(n)  **Space:** O(1) interleave / O(n) map
**Approach:** Interleave cloned nodes right after their originals (A -> A' -> B -> B' ...). Set each clone's random from `orig.random.next`, then unweave the two lists. This achieves the clone in constant extra space.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Copy List with Random Pointer](https://leetcode.com/problems/copy-list-with-random-pointer/)


A linked list of length `n` is given such that each node contains an additional random pointer, which could point to any node in the list, or `null`.

Construct a <a href="https://en.wikipedia.org/wiki/Object_copying#Deep_copy" target="_blank">**deep copy**</a> of the list. The deep copy should consist of exactly `n` **brand new** nodes, where each new node has its value set to the value of its corresponding original node. Both the `next` and `random` pointer of the new nodes should point to new nodes in the copied list such that the pointers in the original list and copied list represent the same list state. **None of the pointers in the new list should point to nodes in the original list**.

For example, if there are two nodes `X` and `Y` in the original list, where `X.random --> Y`, then for the corresponding two nodes `x` and `y` in the copied list, `x.random --> y`.

Return *the head of the copied linked list*.

The linked list is represented in the input/output as a list of `n` nodes. Each node is represented as a pair of `[val, random_index]` where:

	- `val`: an integer representing `Node.val`

	- `random_index`: the index of the node (range from `0` to `n-1`) that the `random` pointer points to, or `null` if it does not point to any node.

Your code will **only** be given the `head` of the original linked list.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2019/12/18/e1.png" style="width: 700px; height: 142px;" />

```text

**Input:** head = [[7,null],[13,0],[11,4],[10,2],[1,0]]
**Output:** [[7,null],[13,0],[11,4],[10,2],[1,0]]

```

<strong class="example">Example 2:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2019/12/18/e2.png" style="width: 700px; height: 114px;" />

```text

**Input:** head = [[1,1],[2,1]]
**Output:** [[1,1],[2,1]]

```

<strong class="example">Example 3:</strong>

**<img alt="" src="https://assets.leetcode.com/uploads/2019/12/18/e3.png" style="width: 700px; height: 122px;" />**

```text

**Input:** head = [[3,null],[3,0],[3,null]]
**Output:** [[3,null],[3,0],[3,null]]

```

 

**Constraints:**

	- `0 <= n <= 1000`

	- `-10<sup>4</sup> <= Node.val <= 10<sup>4</sup>`

	- `Node.random` is `null` or is pointing to some node in the linked list.

</details>

```java
class Node {
    int val; // Value of the node
    Node next, random; // next points to the sequential next node; random points to an arbitrary node
    Node(int val) { this.val = val; } // Constructor to initialize the value
}

public Node copyRandomList(Node head) {
    if (head == null) return null; // Base case: empty list returns null
    // Step 1: Interleave clones directly after their originals (A -> A' -> B -> B')
    for (Node cur = head; cur != null; cur = cur.next.next) {
        Node copy = new Node(cur.val); // Create the cloned node
        copy.next = cur.next; // Link the clone to the next original node
        cur.next = copy; // Link the original node to its clone
    }
    // Step 2: Assign random pointers for the cloned nodes
    for (Node cur = head; cur != null; cur = cur.next.next) {
        // The clone's random pointer is the clone of the original's random pointer
        cur.next.random = (cur.random != null) ? cur.random.next : null; 
    }
    // Step 3: Unweave the lists back into original and clone lists
    Node dummy = new Node(0); // Dummy node for the head of the cloned list
    Node copyTail = dummy; // copyTail builds the cloned list
    for (Node cur = head; cur != null; cur = cur.next) {
        copyTail.next = cur.next; // Extract the clone node
        copyTail = copyTail.next; // Move copyTail forward
        cur.next = cur.next.next; // Restore the original list's next pointer
    }
    return dummy.next; // Return the head of the standalone cloned list
}
```
**Alternative:** Use a `HashMap<Node, Node>` from original to clone in two passes — O(n) space, easier to reason about.

---

## Stack / Queue Design

### Min Stack
**Category:** ⭐ Tier 1 · Core
**Pattern:** Auxiliary tracking  **Time:** O(1) per op  **Space:** O(n)
**Approach:** Keep a second stack that tracks the minimum seen so far. On push, store `min(value, currentMin)`; on pop, remove from both. The top of the min stack always reflects the minimum of the current contents.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Min Stack](https://leetcode.com/problems/min-stack/)


Design a stack that supports push, pop, top, and retrieving the minimum element in constant time.

Implement the `MinStack` class:

	- `MinStack()` initializes the stack object.

	- `void push(int value)` pushes the element `value` onto the stack.

	- `void pop()` removes the element on the top of the stack.

	- `int top()` gets the top element of the stack.

	- `int getMin()` retrieves the minimum element in the stack.

You must implement a solution with `O(1)` time complexity for each function.

 

<strong class="example">Example 1:</strong>

```text

**Input**
["MinStack","push","push","push","getMin","pop","top","getMin"]
[[],[-2],[0],[-3],[],[],[],[]]

**Output**
[null,null,null,null,-3,null,0,-2]

**Explanation**
MinStack minStack = new MinStack();
minStack.push(-2);
minStack.push(0);
minStack.push(-3);
minStack.getMin(); // return -3
minStack.pop();
minStack.top();    // return 0
minStack.getMin(); // return -2

```

 

**Constraints:**

	- `-2<sup>31</sup> <= val <= 2<sup>31</sup> - 1`

	- Methods `pop`, `top` and `getMin` operations will always be called on **non-empty** stacks.

	- At most `3 * 10<sup>4</sup>` calls will be made to `push`, `pop`, `top`, and `getMin`.

</details>

```java
class MinStack {
    private Deque<Integer> stack = new ArrayDeque<>(); // Main stack to hold elements
    private Deque<Integer> mins = new ArrayDeque<>(); // Auxiliary stack to hold current minimums

    public void push(int val) {
        stack.push(val); // Always push the new value onto the main stack
        // Push the minimum of the new value and the current minimum onto the mins stack
        mins.push(mins.isEmpty() ? val : Math.min(val, mins.peek())); 
    }
    public void pop() { 
        stack.pop(); // Remove top element from the main stack
        mins.pop(); // Simultaneously remove the top of the mins stack to keep them in sync
    }
    public int top() { 
        return stack.peek(); // Return the top element of the main stack without removing it
    }
    public int getMin() { 
        return mins.peek(); // Return the top element of the mins stack, which is the current minimum
    }
}
```

### Implement Queue using Stacks
**Category:** Tier 2 · Reinforce
**Pattern:** Two-stack amortization  **Time:** O(1) amortized  **Space:** O(n)
**Approach:** Push always goes to an `in` stack. For pop/peek, if the `out` stack is empty, transfer everything from `in` to `out`, reversing order so the oldest element is on top. Each element is moved at most once, giving amortized O(1).

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Implement Queue using Stacks](https://leetcode.com/problems/implement-queue-using-stacks/)


Implement a first in first out (FIFO) queue using only two stacks. The implemented queue should support all the functions of a normal queue (`push`, `peek`, `pop`, and `empty`).

Implement the `MyQueue` class:

	- `void push(int x)` Pushes element x to the back of the queue.

	- `int pop()` Removes the element from the front of the queue and returns it.

	- `int peek()` Returns the element at the front of the queue.

	- `boolean empty()` Returns `true` if the queue is empty, `false` otherwise.

**Notes:**

	- You must use **only** standard operations of a stack, which means only `push to top`, `peek/pop from top`, `size`, and `is empty` operations are valid.

	- Depending on your language, the stack may not be supported natively. You may simulate a stack using a list or deque (double-ended queue) as long as you use only a stack's standard operations.

 

<strong class="example">Example 1:</strong>

```text

**Input**
["MyQueue", "push", "push", "peek", "pop", "empty"]
[[], [1], [2], [], [], []]
**Output**
[null, null, null, 1, 1, false]

**Explanation**
MyQueue myQueue = new MyQueue();
myQueue.push(1); // queue is: [1]
myQueue.push(2); // queue is: [1, 2] (leftmost is front of the queue)
myQueue.peek(); // return 1
myQueue.pop(); // return 1, queue is [2]
myQueue.empty(); // return false

```

 

**Constraints:**

	- `1 <= x <= 9`

	- At most `100` calls will be made to `push`, `pop`, `peek`, and `empty`.

	- All the calls to `pop` and `peek` are valid.

 

**Follow-up:** Can you implement the queue such that each operation is **<a href="https://en.wikipedia.org/wiki/Amortized_analysis" target="_blank">amortized</a>** `O(1)` time complexity? In other words, performing `n` operations will take overall `O(n)` time even if one of those operations may take longer.

</details>

```java
class MyQueue {
    private Deque<Integer> in = new ArrayDeque<>(); // Stack used for enqueueing elements
    private Deque<Integer> out = new ArrayDeque<>(); // Stack used for dequeueing/peeking elements

    public void push(int x) { 
        in.push(x); // Pushing always goes to the 'in' stack (O(1))
    }
    public int pop() { 
        peek(); // Ensure the 'out' stack has the oldest elements ready
        return out.pop(); // Remove and return the front element of the queue
    }
    public int peek() {
        if (out.isEmpty()) // If 'out' stack is empty, we must transfer elements from 'in' stack
            while (!in.isEmpty()) out.push(in.pop()); // Transfer reverses order, making the oldest element top of 'out'
        return out.peek(); // Return the top of 'out' (which is the front of the queue)
    }
    public boolean empty() { 
        return in.isEmpty() && out.isEmpty(); // Queue is empty only if both stacks are empty
    }
}
```

### Implement Stack using Queues
**Category:** Tier 3 · Reference
**Pattern:** Single-queue rotation  **Time:** O(n) push, O(1) pop  **Space:** O(n)
**Approach:** Use one queue. On push, enqueue the new element, then rotate every preceding element to the back so the newest sits at the front. Pop/top then become trivial front operations.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Implement Stack using Queues](https://leetcode.com/problems/implement-stack-using-queues/)


Implement a last-in-first-out (LIFO) stack using only two queues. The implemented stack should support all the functions of a normal stack (`push`, `top`, `pop`, and `empty`).

Implement the `MyStack` class:

	- `void push(int x)` Pushes element x to the top of the stack.

	- `int pop()` Removes the element on the top of the stack and returns it.

	- `int top()` Returns the element on the top of the stack.

	- `boolean empty()` Returns `true` if the stack is empty, `false` otherwise.

**Notes:**

	- You must use **only** standard operations of a queue, which means that only `push to back`, `peek/pop from front`, `size` and `is empty` operations are valid.

	- Depending on your language, the queue may not be supported natively. You may simulate a queue using a list or deque (double-ended queue) as long as you use only a queue's standard operations.

 

<strong class="example">Example 1:</strong>

```text

**Input**
["MyStack", "push", "push", "top", "pop", "empty"]
[[], [1], [2], [], [], []]
**Output**
[null, null, null, 2, 2, false]

**Explanation**
MyStack myStack = new MyStack();
myStack.push(1);
myStack.push(2);
myStack.top(); // return 2
myStack.pop(); // return 2
myStack.empty(); // return False

```

 

**Constraints:**

	- `1 <= x <= 9`

	- At most `100` calls will be made to `push`, `pop`, `top`, and `empty`.

	- All the calls to `pop` and `top` are valid.

 

**Follow-up:** Can you implement the stack using only one queue?

</details>

```java
class MyStack {
    private Queue<Integer> q = new LinkedList<>(); // Single queue to simulate a stack

    public void push(int x) {
        q.offer(x); // Enqueue the new element at the back of the queue
        // Rotate the queue by removing the front element and adding it to the back
        // Do this for all elements EXCEPT the one we just added
        for (int i = 1; i < q.size(); i++) q.offer(q.poll()); 
        // Now the newly added element 'x' is at the front of the queue, acting like stack's top
    }
    public int pop() { 
        return q.poll(); // Dequeue the front element (which is the top of the simulated stack)
    }
    public int top() { 
        return q.peek(); // Peek at the front element
    }
    public boolean empty() { 
        return q.isEmpty(); // Check if the underlying queue is empty
    }
}
```

---

## Monotonic Stack

### Next Greater Element I
**Category:** Tier 2 · Reinforce
**Pattern:** Monotonic decreasing stack + hashmap  **Time:** O(n + m)  **Space:** O(n)
**Approach:** Scan `nums2` keeping a stack of values awaiting a greater element. When the current value exceeds the stack top, it is that element's next-greater; record it in a map and pop. Finally look up each `nums1` element.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Next Greater Element I](https://leetcode.com/problems/next-greater-element-i/)


The **next greater element** of some element `x` in an array is the **first greater** element that is **to the right** of `x` in the same array.

You are given two **distinct 0-indexed** integer arrays `nums1` and `nums2`, where `nums1` is a subset of `nums2`.

For each `0 <= i < nums1.length`, find the index `j` such that `nums1[i] == nums2[j]` and determine the **next greater element** of `nums2[j]` in `nums2`. If there is no next greater element, then the answer for this query is `-1`.

Return *an array *`ans`* of length *`nums1.length`* such that *`ans[i]`* is the **next greater element** as described above.*

 

<strong class="example">Example 1:</strong>

```text

**Input:** nums1 = [4,1,2], nums2 = [1,3,4,2]
**Output:** [-1,3,-1]
**Explanation:** The next greater element for each value of nums1 is as follows:
- 4 is underlined in nums2 = [1,3,<u>4</u>,2]. There is no next greater element, so the answer is -1.
- 1 is underlined in nums2 = [<u>1</u>,3,4,2]. The next greater element is 3.
- 2 is underlined in nums2 = [1,3,4,<u>2</u>]. There is no next greater element, so the answer is -1.

```

<strong class="example">Example 2:</strong>

```text

**Input:** nums1 = [2,4], nums2 = [1,2,3,4]
**Output:** [3,-1]
**Explanation:** The next greater element for each value of nums1 is as follows:
- 2 is underlined in nums2 = [1,<u>2</u>,3,4]. The next greater element is 3.
- 4 is underlined in nums2 = [1,2,3,<u>4</u>]. There is no next greater element, so the answer is -1.

```

 

**Constraints:**

	- `1 <= nums1.length <= nums2.length <= 1000`

	- `0 <= nums1[i], nums2[i] <= 10<sup>4</sup>`

	- All integers in `nums1` and `nums2` are **unique**.

	- All the integers of `nums1` also appear in `nums2`.

 
**Follow up:** Could you find an `O(nums1.length + nums2.length)` solution?

</details>

```java
public int[] nextGreaterElement(int[] nums1, int[] nums2) {
    Map<Integer, Integer> nge = new HashMap<>(); // Map to store the next greater element for each value in nums2
    Deque<Integer> stack = new ArrayDeque<>(); // Stack will store elements in decreasing order
    for (int x : nums2) { // Iterate through nums2 to find next greater elements
        // If current element x is greater than the stack's top, it's the next greater element for the stack's top
        while (!stack.isEmpty() && x > stack.peek())
            nge.put(stack.pop(), x); // Pop the smaller element and map it to x
        stack.push(x); // Push the current element onto the stack to find its next greater element later
    }
    int[] res = new int[nums1.length]; // Result array for nums1
    for (int i = 0; i < nums1.length; i++) // Iterate through nums1
        res[i] = nge.getOrDefault(nums1[i], -1); // Retrieve the precomputed NGE from the map, default to -1 if not found
    return res; // Return the final results
}
```

### Daily Temperatures
**Category:** ⭐ Tier 1 · Core
**Pattern:** Monotonic decreasing stack of indices  **Time:** O(n)  **Space:** O(n)
**Approach:** Maintain a stack of indices whose warmer day hasn't been found yet. When today is warmer than the day at the stack top, pop and record the index gap as the wait. Each index is pushed and popped once.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Daily Temperatures](https://leetcode.com/problems/daily-temperatures/)


Given an array of integers `temperatures` represents the daily temperatures, return *an array* `answer` *such that* `answer[i]` *is the number of days you have to wait after the* `i<sup>th</sup>` *day to get a warmer temperature*. If there is no future day for which this is possible, keep `answer[i] == 0` instead.

 

<strong class="example">Example 1:</strong>

```text
**Input:** temperatures = [73,74,75,71,69,72,76,73]
**Output:** [1,1,4,2,1,1,0,0]

```

<strong class="example">Example 2:</strong>

```text
**Input:** temperatures = [30,40,50,60]
**Output:** [1,1,1,0]

```

<strong class="example">Example 3:</strong>

```text
**Input:** temperatures = [30,60,90]
**Output:** [1,1,0]

```

 

**Constraints:**

	- `1 <= temperatures.length <= 10<sup>5</sup>`

	- `30 <= temperatures[i] <= 100`

</details>

```java
public int[] dailyTemperatures(int[] temps) {
    int n = temps.length; // Length of the temperatures array
    int[] res = new int[n]; // Result array initialized to 0s by default
    Deque<Integer> stack = new ArrayDeque<>(); // Stack stores INDICES of temperatures, not the values
    for (int i = 0; i < n; i++) { // Iterate through the temperatures
        // While current temp is greater than the temp at the index stored at the top of the stack
        while (!stack.isEmpty() && temps[i] > temps[stack.peek()]) {
            int j = stack.pop(); // Pop the index of the colder day
            res[j] = i - j; // Calculate the number of days waited and store it in result at index j
        }
        stack.push(i); // Push the current day's index onto the stack
    }
    return res; // Any remaining indices in the stack implicitly have 0 in the result array
}
```

### Largest Rectangle in Histogram
**Category:** ⭐ Tier 1 · Core
**Pattern:** Monotonic increasing stack  **Time:** O(n)  **Space:** O(n)
**Approach:** Keep a stack of indices with increasing bar heights. When a shorter bar appears, pop taller bars and compute the rectangle each can form: its height times the width bounded by the new bar on the right and the new stack top on the left. A sentinel height of 0 flushes the stack at the end.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Largest Rectangle in Histogram](https://leetcode.com/problems/largest-rectangle-in-histogram/)


Given an array of integers `heights` representing the histogram's bar height where the width of each bar is `1`, return *the area of the largest rectangle in the histogram*.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2021/01/04/histogram.jpg" style="width: 522px; height: 242px;" />

```text

**Input:** heights = [2,1,5,6,2,3]
**Output:** 10
**Explanation:** The above is a histogram where width of each bar is 1.
The largest rectangle is shown in the red area, which has an area = 10 units.

```

<strong class="example">Example 2:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2021/01/04/histogram-1.jpg" style="width: 202px; height: 362px;" />

```text

**Input:** heights = [2,4]
**Output:** 4

```

 

**Constraints:**

	- `1 <= heights.length <= 10<sup>5</sup>`

	- `0 <= heights[i] <= 10<sup>4</sup>`

</details>

```java
public int largestRectangleArea(int[] heights) {
    int n = heights.length, max = 0; // Initialize max area to 0
    Deque<Integer> stack = new ArrayDeque<>(); // Stack to store indices of the histogram bars
    for (int i = 0; i <= n; i++) { // Iterate up to n to handle the remaining elements in the stack
        int h = (i == n) ? 0 : heights[i]; // Sentinel height 0 at the end forces all remaining bars to pop
        // While the current bar is shorter than the bar at the top of the stack
        while (!stack.isEmpty() && h < heights[stack.peek()]) {
            int height = heights[stack.pop()]; // The height of the rectangle is determined by the popped bar
            // Width is the distance between current index i and the new top of the stack
            int width = stack.isEmpty() ? i : i - stack.peek() - 1;
            max = Math.max(max, height * width); // Update the maximum area found so far
        }
        stack.push(i); // Push the current index onto the stack to continue processing
    }
    return max; // Return the maximum rectangular area
}
```

### Remove K Digits
**Category:** Tier 2 · Reinforce
**Pattern:** Monotonic increasing stack (greedy)  **Time:** O(n)  **Space:** O(n)
**Approach:** Build the smallest number by greedily removing a preceding digit whenever it is larger than the current one (it costs the most at a high place value). Use a stack as the result buffer, removing up to `k` digits; trim any leftover removals from the end and strip leading zeros.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Remove K Digits](https://leetcode.com/problems/remove-k-digits/)


Given string num representing a non-negative integer `num`, and an integer `k`, return *the smallest possible integer after removing* `k` *digits from* `num`.

 

<strong class="example">Example 1:</strong>

```text

**Input:** num = "1432219", k = 3
**Output:** "1219"
**Explanation:** Remove the three digits 4, 3, and 2 to form the new number 1219 which is the smallest.

```

<strong class="example">Example 2:</strong>

```text

**Input:** num = "10200", k = 1
**Output:** "200"
**Explanation:** Remove the leading 1 and the number is 200. Note that the output must not contain leading zeroes.

```

<strong class="example">Example 3:</strong>

```text

**Input:** num = "10", k = 2
**Output:** "0"
**Explanation:** Remove all the digits from the number and it is left with nothing which is 0.

```

 

**Constraints:**

	- `1 <= k <= num.length <= 10<sup>5</sup>`

	- `num` consists of only digits.

	- `num` does not have any leading zeros except for the zero itself.

</details>

```java
public String removeKdigits(String num, int k) {
    Deque<Character> stack = new ArrayDeque<>(); // Deque used as a monotonic increasing stack
    for (char c : num.toCharArray()) { // Iterate over every digit in the string
        // While we still have digits to remove (k > 0), the stack isn't empty, 
        // and the top of the stack is greater than the current digit 'c'
        while (k > 0 && !stack.isEmpty() && stack.peek() > c) {
            stack.pop(); // Remove the larger preceding digit to make the number smaller
            k--; // Decrement the remaining removal allowance
        }
        stack.push(c); // Push the current digit onto the stack
    }
    while (k-- > 0) stack.pop(); // If we still need to remove digits, remove from the end (the largest remaining)
    StringBuilder sb = new StringBuilder(); // To build the resulting string
    Iterator<Character> it = stack.descendingIterator(); // Iterate from bottom to top of stack
    while (it.hasNext()) sb.append(it.next()); // Append digits to string builder
    while (sb.length() > 1 && sb.charAt(0) == '0') sb.deleteCharAt(0); // Strip any leading zeros
    return sb.length() == 0 ? "0" : sb.toString(); // Return "0" if empty, else the final string
}
```

### Stock Span
**Category:** Tier 3 · Reference
**Pattern:** Monotonic decreasing stack of (price, span)  **Time:** O(1) amortized  **Space:** O(n)
**Approach:** For each day, the span is the count of consecutive prior days with price <= today. Keep a stack of (price, span) pairs; pop and accumulate spans while the top price is <= today's, then push the merged span. Each price is pushed/popped once.

<!-- Problem Statement not automatically found -->

```java
class StockSpanner {
    private Deque<int[]> stack = new ArrayDeque<>(); // Stack stores arrays: [price, span]

    public int next(int price) {
        int span = 1; // Default span is 1 (the current day itself)
        // While stack isn't empty and the prior day's price is <= today's price
        while (!stack.isEmpty() && stack.peek()[0] <= price)
            span += stack.pop()[1]; // Add the prior day's span to today's span and pop it
        stack.push(new int[]{price, span}); // Push today's price and its accumulated span
        return span; // Return the accumulated span
    }
}
```

---

## Monotonic Deque

### Sliding Window Maximum
**Category:** ⭐ Tier 1 · Core
**Pattern:** Monotonic decreasing deque of indices  **Time:** O(n)  **Space:** O(k)
**Approach:** Maintain a deque of indices whose values are in decreasing order; the front is always the window's maximum. Before adding index `i`, pop smaller values from the back and evict the front if it has slid out of the window. Record the front once the first full window forms.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Sliding Window Maximum](https://leetcode.com/problems/sliding-window-maximum/)


You are given an array of integers `nums`, there is a sliding window of size `k` which is moving from the very left of the array to the very right. You can only see the `k` numbers in the window. Each time the sliding window moves right by one position.

Return *the max sliding window*.

 

<strong class="example">Example 1:</strong>

```text

**Input:** nums = [1,3,-1,-3,5,3,6,7], k = 3
**Output:** [3,3,5,5,6,7]
**Explanation:** 
Window position                Max
---------------               -----
[1  3  -1] -3  5  3  6  7       **3**
 1 [3  -1  -3] 5  3  6  7       **3**
 1  3 [-1  -3  5] 3  6  7      ** 5**
 1  3  -1 [-3  5  3] 6  7       **5**
 1  3  -1  -3 [5  3  6] 7       **6**
 1  3  -1  -3  5 [3  6  7]      **7**

```

<strong class="example">Example 2:</strong>

```text

**Input:** nums = [1], k = 1
**Output:** [1]

```

 

**Constraints:**

	- `1 <= nums.length <= 10<sup>5</sup>`

	- `-10<sup>4</sup> <= nums[i] <= 10<sup>4</sup>`

	- `1 <= k <= nums.length`

</details>

```java
public int[] maxSlidingWindow(int[] nums, int k) {
    int n = nums.length; // Length of input array
    int[] res = new int[n - k + 1]; // Result array for sliding window maximums
    Deque<Integer> dq = new ArrayDeque<>(); // Deque to store indices; values remain monotonically decreasing
    for (int i = 0; i < n; i++) { // Iterate over the array
        // Remove indices that are out of the current sliding window [i - k + 1, i]
        if (!dq.isEmpty() && dq.peekFirst() <= i - k) dq.pollFirst();
        // Remove elements from the back if they are smaller than the current element
        // (they can never be the maximum since the current is larger and comes later)
        while (!dq.isEmpty() && nums[dq.peekLast()] <= nums[i]) dq.pollLast();
        dq.offerLast(i); // Add current index to the back of the deque
        // If we have processed at least k elements, record the maximum at the front
        if (i >= k - 1) res[i - k + 1] = nums[dq.peekFirst()];
    }
    return res; // Return the array of maximums
}
```

### Shortest Subarray with Sum at Least K
**Category:** Tier 3 · Reference
**Pattern:** Prefix sums + monotonic increasing deque  **Time:** O(n)  **Space:** O(n)
**Approach:** Compute prefix sums; a subarray sum is `prefix[j] - prefix[i]`. Maintain a deque of indices with increasing prefix values. For each `j`, pop from the front while `prefix[j] - prefix[front] >= K` (recording the length), and pop from the back any index whose prefix is >= the current — it can never beat a smaller, later prefix.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Shortest Subarray with Sum at Least K](https://leetcode.com/problems/shortest-subarray-with-sum-at-least-k/)


Given an integer array `nums` and an integer `k`, return *the length of the shortest non-empty **subarray** of *`nums`* with a sum of at least *`k`. If there is no such **subarray**, return `-1`.

A **subarray** is a **contiguous** part of an array.

 

<strong class="example">Example 1:</strong>

```text
**Input:** nums = [1], k = 1
**Output:** 1

```

<strong class="example">Example 2:</strong>

```text
**Input:** nums = [1,2], k = 4
**Output:** -1

```

<strong class="example">Example 3:</strong>

```text
**Input:** nums = [2,-1,2], k = 3
**Output:** 3

```

 

**Constraints:**

	- `1 <= nums.length <= 10<sup>5</sup>`

	- `-10<sup>5</sup> <= nums[i] <= 10<sup>5</sup>`

	- `1 <= k <= 10<sup>9</sup>`

</details>

```java
public int shortestSubarray(int[] nums, int k) {
    int n = nums.length; // Array length
    long[] prefix = new long[n + 1]; // Array to store prefix sums, n+1 to handle edge cases
    for (int i = 0; i < n; i++) prefix[i + 1] = prefix[i] + nums[i]; // Compute prefix sums
    int res = n + 1; // Initialize shortest length to an impossibly large value
    Deque<Integer> dq = new ArrayDeque<>(); // Deque to store indices, keeping prefix sums monotonically increasing
    for (int j = 0; j <= n; j++) { // Iterate through the prefix sums
        // If the difference between current prefix and front of deque is >= k, we found a valid subarray
        while (!dq.isEmpty() && prefix[j] - prefix[dq.peekFirst()] >= k)
            res = Math.min(res, j - dq.pollFirst()); // Update shortest length and remove front (can't form a shorter valid subarray later)
        // Maintain monotonicity: remove indices from the back if their prefix sum is >= current prefix sum
        while (!dq.isEmpty() && prefix[dq.peekLast()] >= prefix[j])
            dq.pollLast(); // A larger/equal prefix sum earlier is worse than a smaller/equal one later
        dq.offerLast(j); // Add current index to the deque
    }
    return res <= n ? res : -1; // Return the shortest length, or -1 if no valid subarray was found
}
```

---

## Merge Intervals

### Merge Intervals
**Category:** ⭐ Tier 1 · Core
**Pattern:** Sort + sweep  **Time:** O(n log n)  **Space:** O(n)
**Approach:** Sort intervals by start. Walk through them, extending the current merged interval's end whenever the next interval overlaps (its start <= current end); otherwise close the current interval and start a new one.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Merge Intervals](https://leetcode.com/problems/merge-intervals/)


Given an array of `intervals` where `intervals[i] = [start<sub>i</sub>, end<sub>i</sub>]`, merge all overlapping intervals, and return *an array of the non-overlapping intervals that cover all the intervals in the input*.

 

<strong class="example">Example 1:</strong>

```text

**Input:** intervals = [[1,3],[2,6],[8,10],[15,18]]
**Output:** [[1,6],[8,10],[15,18]]
**Explanation:** Since intervals [1,3] and [2,6] overlap, merge them into [1,6].

```

<strong class="example">Example 2:</strong>

```text

**Input:** intervals = [[1,4],[4,5]]
**Output:** [[1,5]]
**Explanation:** Intervals [1,4] and [4,5] are considered overlapping.

```

<strong class="example">Example 3:</strong>

```text

**Input:** intervals = [[4,7],[1,4]]
**Output:** [[1,7]]
**Explanation:** Intervals [1,4] and [4,7] are considered overlapping.

```

 

**Constraints:**

	- `1 <= intervals.length <= 10<sup>4</sup>`

	- `intervals[i].length == 2`

	- `0 <= start<sub>i</sub> <= end<sub>i</sub> <= 10<sup>4</sup>`

</details>

```java
public int[][] merge(int[][] intervals) {
    // Sort intervals by their start times to process them chronologically
    Arrays.sort(intervals, (a, b) -> Integer.compare(a[0], b[0]));
    List<int[]> res = new ArrayList<>(); // Result list to hold merged intervals
    int[] cur = intervals[0]; // Start with the first interval as the current working interval
    for (int i = 1; i < intervals.length; i++) { // Iterate through the rest of the intervals
        if (intervals[i][0] <= cur[1]) { // If the next interval overlaps with the current one
            cur[1] = Math.max(cur[1], intervals[i][1]); // Extend the end time of the current interval
        } else { // No overlap found
            res.add(cur); // The current merged interval is finalized, add it to results
            cur = intervals[i]; // Start a new current interval
        }
    }
    res.add(cur); // Add the final working interval after the loop finishes
    return res.toArray(new int[0][]); // Convert list of arrays to 2D array and return
}
```

### Insert Interval
**Category:** Tier 2 · Reinforce
**Pattern:** Three-phase sweep  **Time:** O(n)  **Space:** O(n)
**Approach:** The input is already sorted. Copy all intervals ending before the new one starts, then merge every interval that overlaps the new one by widening its bounds, finally copy the rest. No global sort needed.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Insert Interval](https://leetcode.com/problems/insert-interval/)


You are given an array of non-overlapping intervals `intervals` where `intervals[i] = [start<sub>i</sub>, end<sub>i</sub>]` represent the start and the end of the `i<sup>th</sup>` interval and `intervals` is sorted in ascending order by `start<sub>i</sub>`. You are also given an interval `newInterval = [start, end]` that represents the start and end of another interval.

Two intervals are considered overlapping if they share **at least** one point.

Insert `newInterval` into `intervals` such that `intervals` is still sorted in ascending order by `start<sub>i</sub>` and `intervals` still does not have any overlapping intervals (merge overlapping intervals if necessary).

Return `intervals`* after the insertion*.

**Note** that you don't need to modify `intervals` in-place. You can make a new array and return it.

 

<strong class="example">Example 1:</strong>

```text

**Input:** intervals = [[1,3],[6,9]], newInterval = [2,5]
**Output:** [[1,5],[6,9]]

```

<strong class="example">Example 2:</strong>

```text

**Input:** intervals = [[1,2],[3,5],[6,7],[8,10],[12,16]], newInterval = [4,8]
**Output:** [[1,2],[3,10],[12,16]]
**Explanation:** Because the new interval [4,8] overlaps with [3,5],[6,7],[8,10].

```

 

**Constraints:**

	- `0 <= intervals.length <= 10<sup>4</sup>`

	- `intervals[i].length == 2`

	- `0 <= start<sub>i</sub> <= end<sub>i</sub> <= 10<sup>5</sup>`

	- `intervals` is sorted by `start<sub>i</sub>` in **ascending** order.

	- `newInterval.length == 2`

	- `0 <= start <= end <= 10<sup>5</sup>`

</details>

```java
public int[][] insert(int[][] intervals, int[] newInterval) {
    List<int[]> res = new ArrayList<>(); // List to store the final intervals
    int i = 0, n = intervals.length; // Pointer i and length of array
    // Phase 1: Add all intervals that end entirely before the new interval starts
    while (i < n && intervals[i][1] < newInterval[0]) res.add(intervals[i++]);
    // Phase 2: Merge all overlapping intervals into the new interval
    while (i < n && intervals[i][0] <= newInterval[1]) {
        newInterval[0] = Math.min(newInterval[0], intervals[i][0]); // Extend the start boundary if needed
        newInterval[1] = Math.max(newInterval[1], intervals[i][1]); // Extend the end boundary if needed
        i++; // Move to the next interval
    }
    res.add(newInterval); // Add the newly merged interval
    // Phase 3: Add all remaining intervals that start after the new interval ends
    while (i < n) res.add(intervals[i++]);
    return res.toArray(new int[0][]); // Convert list to 2D array and return
}
```

### Non-overlapping Intervals
**Category:** ⭐ Tier 1 · Core
**Pattern:** Greedy by earliest end  **Time:** O(n log n)  **Space:** O(1)
**Approach:** Sort by end time. Greedily keep an interval if it starts at or after the last kept end; otherwise it overlaps and must be removed. Choosing the interval that ends earliest leaves the most room for the rest.

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
public int eraseOverlapIntervals(int[][] intervals) {
    // Sort intervals by their end times to greedily leave the most space for remaining intervals
    Arrays.sort(intervals, (a, b) -> Integer.compare(a[1], b[1]));
    int removed = 0, end = Integer.MIN_VALUE; // Initialize removed counter, and end marker
    for (int[] in : intervals) { // Iterate through the sorted intervals
        if (in[0] >= end) end = in[1]; // If it doesn't overlap with the previous, keep it and update the end
        else removed++; // Otherwise, it overlaps so we must remove it
    }
    return removed; // Return the total number of removed intervals
}
```

### Meeting Rooms II
**Category:** Tier 2 · Reinforce
**Pattern:** Min-heap of end times (or sweep line)  **Time:** O(n log n)  **Space:** O(n)
**Approach:** Sort meetings by start time and use a min-heap holding the end times of rooms currently in use. For each meeting, if the earliest-ending room is free by its start, reuse it (poll); otherwise allocate a new room. The heap size's peak is the answer.

<!-- Problem Statement not automatically found -->

```java
public int minMeetingRooms(int[][] intervals) {
    // Sort the meetings by their start times
    Arrays.sort(intervals, (a, b) -> Integer.compare(a[0], b[0]));
    // Min-heap to keep track of the end times of ongoing meetings
    PriorityQueue<Integer> heap = new PriorityQueue<>();
    for (int[] in : intervals) { // Iterate over all meetings
        // If the earliest ending meeting finishes before or exactly when the current one starts
        if (!heap.isEmpty() && heap.peek() <= in[0]) heap.poll(); // Free up that meeting room
        heap.offer(in[1]); // Allocate a room for the current meeting by adding its end time
    }
    return heap.size(); // The size of the heap is the max simultaneous rooms needed
}
```
**Alternative:** Sweep line — sort all start (+1) and end (-1) events, track a running counter and its maximum. Same complexity, O(n) extra.

### Interval List Intersections
**Category:** Tier 3 · Reference
**Pattern:** Two-pointer merge  **Time:** O(n + m)  **Space:** O(n + m)
**Approach:** Both lists are sorted. For the pair under each pointer, the intersection (if any) is `[max(starts), min(ends)]`; emit it when valid. Advance the pointer whose interval ends first, since it cannot intersect any later interval in the other list.

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Interval List Intersections](https://leetcode.com/problems/interval-list-intersections/)


You are given two lists of closed intervals, `firstList` and `secondList`, where `firstList[i] = [start<sub>i</sub>, end<sub>i</sub>]` and `secondList[j] = [start<sub>j</sub>, end<sub>j</sub>]`. Each list of intervals is pairwise **disjoint** and in **sorted order**.

Return *the intersection of these two interval lists*.

A **closed interval** `[a, b]` (with `a <= b`) denotes the set of real numbers `x` with `a <= x <= b`.

The **intersection** of two closed intervals is a set of real numbers that are either empty or represented as a closed interval. For example, the intersection of `[1, 3]` and `[2, 4]` is `[2, 3]`.

 

<strong class="example">Example 1:</strong>
<img alt="" src="https://assets.leetcode.com/uploads/2019/01/30/interval1.png" style="width: 700px; height: 194px;" />

```text

**Input:** firstList = [[0,2],[5,10],[13,23],[24,25]], secondList = [[1,5],[8,12],[15,24],[25,26]]
**Output:** [[1,2],[5,5],[8,10],[15,23],[24,24],[25,25]]

```

<strong class="example">Example 2:</strong>

```text

**Input:** firstList = [[1,3],[5,9]], secondList = []
**Output:** []

```

 

**Constraints:**

	- `0 <= firstList.length, secondList.length <= 1000`

	- `firstList.length + secondList.length >= 1`

	- `0 <= start<sub>i</sub> < end<sub>i</sub> <= 10<sup>9</sup>`

	- `end<sub>i</sub> < start<sub>i+1</sub>`

	- `0 <= start<sub>j</sub> < end<sub>j</sub> <= 10<sup>9</sup> `

	- `end<sub>j</sub> < start<sub>j+1</sub>`

</details>

```java
public int[][] intervalIntersection(int[][] A, int[][] B) {
    List<int[]> res = new ArrayList<>(); // Result list for intersecting intervals
    int i = 0, j = 0; // Pointers for iterating through arrays A and B
    while (i < A.length && j < B.length) { // Loop while both arrays have intervals left
        int lo = Math.max(A[i][0], B[j][0]); // Intersection start is the later of the two starts
        int hi = Math.min(A[i][1], B[j][1]); // Intersection end is the earlier of the two ends
        if (lo <= hi) res.add(new int[]{lo, hi}); // If valid intersection, add it to results
        // Move the pointer for the interval that ends earlier, as it cannot intersect with anything else
        if (A[i][1] < B[j][1]) i++;
        else j++;
    }
    return res.toArray(new int[0][]); // Convert result list to 2D array
}
```
