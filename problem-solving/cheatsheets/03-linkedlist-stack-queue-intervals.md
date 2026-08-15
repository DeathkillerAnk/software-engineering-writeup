# 03 · Linked Lists, Stacks, Queues & Intervals

Patterns and idiomatic Java for linked-list manipulation, stack/queue design, monotonic stacks/deques, and interval merging.

```java
class ListNode {
    int val;
    ListNode next;
    ListNode() {}
    ListNode(int val) { this.val = val; }
    ListNode(int val, ListNode next) { this.val = val; this.next = next; }
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
    ListNode slow = head, fast = head;
    while (fast != null && fast.next != null) {
        slow = slow.next;
        fast = fast.next.next;
        if (slow == fast) return true;
    }
    return false;
}
```

### Linked List Cycle II (find start)
**Category:** ⭐ Tier 1 · Core
**Pattern:** Floyd's cycle detection + math  **Time:** O(n)  **Space:** O(1)
**Approach:** First detect the meeting point with slow/fast. The distance from head to the cycle start equals the distance from the meeting point to the cycle start (mod cycle length). Reset one pointer to head and advance both one step at a time; they meet at the cycle entrance.

<!-- Problem Statement not automatically found -->

```java
public ListNode detectCycle(ListNode head) {
    ListNode slow = head, fast = head;
    while (fast != null && fast.next != null) {
        slow = slow.next;
        fast = fast.next.next;
        if (slow == fast) {
            ListNode p = head;
            while (p != slow) {
                p = p.next;
                slow = slow.next;
            }
            return p;
        }
    }
    return null;
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
    ListNode slow = head, fast = head;
    while (fast != null && fast.next != null) {
        slow = slow.next;
        fast = fast.next.next;
    }
    return slow;
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
    ListNode slow = head, fast = head;
    while (fast != null && fast.next != null) {
        slow = slow.next;
        fast = fast.next.next;
    }
    ListNode second = reverse(slow);
    ListNode p1 = head, p2 = second;
    boolean ok = true;
    while (p2 != null) {
        if (p1.val != p2.val) { ok = false; break; }
        p1 = p1.next;
        p2 = p2.next;
    }
    return ok;
}

private ListNode reverse(ListNode node) {
    ListNode prev = null;
    while (node != null) {
        ListNode next = node.next;
        node.next = prev;
        prev = node;
        node = next;
    }
    return prev;
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
    ListNode prev = null;
    while (head != null) {
        ListNode next = head.next;
        head.next = prev;
        prev = head;
        head = next;
    }
    return prev;
}

// Recursive
public ListNode reverseListRec(ListNode head) {
    if (head == null || head.next == null) return head;
    ListNode newHead = reverseListRec(head.next);
    head.next.next = head;
    head.next = null;
    return newHead;
}
```

### Reverse Linked List II (between m..n)
**Category:** Tier 3 · Reference
**Pattern:** Pointer reversal with dummy head  **Time:** O(n)  **Space:** O(1)
**Approach:** Use a dummy node to handle reversal starting at the head. Advance to the node before position `left`, then repeatedly splice the node after the current "tail of reversed segment" to the front of that segment (head-insertion). After `right - left` splices the sublist is reversed in place.

<!-- Problem Statement not automatically found -->

```java
public ListNode reverseBetween(ListNode head, int left, int right) {
    ListNode dummy = new ListNode(0, head);
    ListNode prev = dummy;
    for (int i = 0; i < left - 1; i++) prev = prev.next;
    ListNode cur = prev.next;
    for (int i = 0; i < right - left; i++) {
        ListNode next = cur.next;
        cur.next = next.next;
        next.next = prev.next;
        prev.next = next;
    }
    return dummy.next;
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
    ListNode dummy = new ListNode(0, head);
    ListNode groupPrev = dummy;
    while (true) {
        ListNode kth = groupPrev;
        for (int i = 0; i < k && kth != null; i++) kth = kth.next;
        if (kth == null) break;
        ListNode groupNext = kth.next;
        ListNode prev = groupNext, cur = groupPrev.next;
        while (cur != groupNext) {
            ListNode next = cur.next;
            cur.next = prev;
            prev = cur;
            cur = next;
        }
        ListNode newTail = groupPrev.next;
        groupPrev.next = kth;
        groupPrev = newTail;
    }
    return dummy.next;
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
    ListNode dummy = new ListNode(0, head);
    ListNode prev = dummy;
    while (prev.next != null && prev.next.next != null) {
        ListNode first = prev.next;
        ListNode second = first.next;
        first.next = second.next;
        second.next = first;
        prev.next = second;
        prev = first;
    }
    return dummy.next;
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
    if (head == null || head.next == null || k == 0) return head;
    int len = 1;
    ListNode tail = head;
    while (tail.next != null) { tail = tail.next; len++; }
    k %= len;
    if (k == 0) return head;
    tail.next = head;                // close ring
    ListNode newTail = head;
    for (int i = 0; i < len - k - 1; i++) newTail = newTail.next;
    ListNode newHead = newTail.next;
    newTail.next = null;
    return newHead;
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
    ListNode dummy = new ListNode(0);
    ListNode tail = dummy;
    while (l1 != null && l2 != null) {
        if (l1.val <= l2.val) { tail.next = l1; l1 = l1.next; }
        else { tail.next = l2; l2 = l2.next; }
        tail = tail.next;
    }
    tail.next = (l1 != null) ? l1 : l2;
    return dummy.next;
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
    ListNode dummy = new ListNode(0);
    ListNode cur = dummy;
    int carry = 0;
    while (l1 != null || l2 != null || carry != 0) {
        int sum = carry;
        if (l1 != null) { sum += l1.val; l1 = l1.next; }
        if (l2 != null) { sum += l2.val; l2 = l2.next; }
        carry = sum / 10;
        cur.next = new ListNode(sum % 10);
        cur = cur.next;
    }
    return dummy.next;
}
```

### Remove Nth Node From End
**Category:** ⭐ Tier 1 · Core
**Pattern:** Two-pointer gap  **Time:** O(n)  **Space:** O(1)
**Approach:** Advance a `fast` pointer n steps ahead of `slow` (both starting at a dummy). Then move both until `fast` reaches the last node; `slow` now sits just before the target, so unlink it. The dummy elegantly handles removing the head.

<!-- Problem Statement not automatically found -->

```java
public ListNode removeNthFromEnd(ListNode head, int n) {
    ListNode dummy = new ListNode(0, head);
    ListNode fast = dummy, slow = dummy;
    for (int i = 0; i < n; i++) fast = fast.next;
    while (fast.next != null) { fast = fast.next; slow = slow.next; }
    slow.next = slow.next.next;
    return dummy.next;
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
    if (head == null || head.next == null) return;
    ListNode slow = head, fast = head;
    while (fast.next != null && fast.next.next != null) {
        slow = slow.next;
        fast = fast.next.next;
    }
    ListNode second = slow.next;
    slow.next = null;
    ListNode prev = null;
    while (second != null) {
        ListNode next = second.next;
        second.next = prev;
        prev = second;
        second = next;
    }
    ListNode first = head;
    while (prev != null) {
        ListNode n1 = first.next, n2 = prev.next;
        first.next = prev;
        prev.next = n1;
        first = n1;
        prev = n2;
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
    int val;
    Node next, random;
    Node(int val) { this.val = val; }
}

public Node copyRandomList(Node head) {
    if (head == null) return null;
    for (Node cur = head; cur != null; cur = cur.next.next) {
        Node copy = new Node(cur.val);
        copy.next = cur.next;
        cur.next = copy;
    }
    for (Node cur = head; cur != null; cur = cur.next.next) {
        cur.next.random = (cur.random != null) ? cur.random.next : null;
    }
    Node dummy = new Node(0);
    Node copyTail = dummy;
    for (Node cur = head; cur != null; cur = cur.next) {
        copyTail.next = cur.next;
        copyTail = copyTail.next;
        cur.next = cur.next.next;
    }
    return dummy.next;
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
    private Deque<Integer> stack = new ArrayDeque<>();
    private Deque<Integer> mins = new ArrayDeque<>();

    public void push(int val) {
        stack.push(val);
        mins.push(mins.isEmpty() ? val : Math.min(val, mins.peek()));
    }
    public void pop() { stack.pop(); mins.pop(); }
    public int top() { return stack.peek(); }
    public int getMin() { return mins.peek(); }
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
    private Deque<Integer> in = new ArrayDeque<>();
    private Deque<Integer> out = new ArrayDeque<>();

    public void push(int x) { in.push(x); }
    public int pop() { peek(); return out.pop(); }
    public int peek() {
        if (out.isEmpty())
            while (!in.isEmpty()) out.push(in.pop());
        return out.peek();
    }
    public boolean empty() { return in.isEmpty() && out.isEmpty(); }
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
    private Queue<Integer> q = new LinkedList<>();

    public void push(int x) {
        q.offer(x);
        for (int i = 1; i < q.size(); i++) q.offer(q.poll());
    }
    public int pop() { return q.poll(); }
    public int top() { return q.peek(); }
    public boolean empty() { return q.isEmpty(); }
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
    Map<Integer, Integer> nge = new HashMap<>();
    Deque<Integer> stack = new ArrayDeque<>();
    for (int x : nums2) {
        while (!stack.isEmpty() && x > stack.peek())
            nge.put(stack.pop(), x);
        stack.push(x);
    }
    int[] res = new int[nums1.length];
    for (int i = 0; i < nums1.length; i++)
        res[i] = nge.getOrDefault(nums1[i], -1);
    return res;
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
    int n = temps.length;
    int[] res = new int[n];
    Deque<Integer> stack = new ArrayDeque<>();
    for (int i = 0; i < n; i++) {
        while (!stack.isEmpty() && temps[i] > temps[stack.peek()]) {
            int j = stack.pop();
            res[j] = i - j;
        }
        stack.push(i);
    }
    return res;
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
    int n = heights.length, max = 0;
    Deque<Integer> stack = new ArrayDeque<>();
    for (int i = 0; i <= n; i++) {
        int h = (i == n) ? 0 : heights[i];
        while (!stack.isEmpty() && h < heights[stack.peek()]) {
            int height = heights[stack.pop()];
            int width = stack.isEmpty() ? i : i - stack.peek() - 1;
            max = Math.max(max, height * width);
        }
        stack.push(i);
    }
    return max;
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
    Deque<Character> stack = new ArrayDeque<>();
    for (char c : num.toCharArray()) {
        while (k > 0 && !stack.isEmpty() && stack.peek() > c) {
            stack.pop();
            k--;
        }
        stack.push(c);
    }
    while (k-- > 0) stack.pop();
    StringBuilder sb = new StringBuilder();
    Iterator<Character> it = stack.descendingIterator();
    while (it.hasNext()) sb.append(it.next());
    while (sb.length() > 1 && sb.charAt(0) == '0') sb.deleteCharAt(0);
    return sb.length() == 0 ? "0" : sb.toString();
}
```

### Stock Span
**Category:** Tier 3 · Reference
**Pattern:** Monotonic decreasing stack of (price, span)  **Time:** O(1) amortized  **Space:** O(n)
**Approach:** For each day, the span is the count of consecutive prior days with price <= today. Keep a stack of (price, span) pairs; pop and accumulate spans while the top price is <= today's, then push the merged span. Each price is pushed/popped once.

<!-- Problem Statement not automatically found -->

```java
class StockSpanner {
    private Deque<int[]> stack = new ArrayDeque<>(); // [price, span]

    public int next(int price) {
        int span = 1;
        while (!stack.isEmpty() && stack.peek()[0] <= price)
            span += stack.pop()[1];
        stack.push(new int[]{price, span});
        return span;
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
    int n = nums.length;
    int[] res = new int[n - k + 1];
    Deque<Integer> dq = new ArrayDeque<>(); // indices, values decreasing
    for (int i = 0; i < n; i++) {
        if (!dq.isEmpty() && dq.peekFirst() <= i - k) dq.pollFirst();
        while (!dq.isEmpty() && nums[dq.peekLast()] <= nums[i]) dq.pollLast();
        dq.offerLast(i);
        if (i >= k - 1) res[i - k + 1] = nums[dq.peekFirst()];
    }
    return res;
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
    int n = nums.length;
    long[] prefix = new long[n + 1];
    for (int i = 0; i < n; i++) prefix[i + 1] = prefix[i] + nums[i];
    int res = n + 1;
    Deque<Integer> dq = new ArrayDeque<>(); // indices, prefix increasing
    for (int j = 0; j <= n; j++) {
        while (!dq.isEmpty() && prefix[j] - prefix[dq.peekFirst()] >= k)
            res = Math.min(res, j - dq.pollFirst());
        while (!dq.isEmpty() && prefix[dq.peekLast()] >= prefix[j])
            dq.pollLast();
        dq.offerLast(j);
    }
    return res <= n ? res : -1;
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
    Arrays.sort(intervals, (a, b) -> Integer.compare(a[0], b[0]));
    List<int[]> res = new ArrayList<>();
    int[] cur = intervals[0];
    for (int i = 1; i < intervals.length; i++) {
        if (intervals[i][0] <= cur[1]) {
            cur[1] = Math.max(cur[1], intervals[i][1]);
        } else {
            res.add(cur);
            cur = intervals[i];
        }
    }
    res.add(cur);
    return res.toArray(new int[0][]);
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
    List<int[]> res = new ArrayList<>();
    int i = 0, n = intervals.length;
    while (i < n && intervals[i][1] < newInterval[0]) res.add(intervals[i++]);
    while (i < n && intervals[i][0] <= newInterval[1]) {
        newInterval[0] = Math.min(newInterval[0], intervals[i][0]);
        newInterval[1] = Math.max(newInterval[1], intervals[i][1]);
        i++;
    }
    res.add(newInterval);
    while (i < n) res.add(intervals[i++]);
    return res.toArray(new int[0][]);
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
    Arrays.sort(intervals, (a, b) -> Integer.compare(a[1], b[1]));
    int removed = 0, end = Integer.MIN_VALUE;
    for (int[] in : intervals) {
        if (in[0] >= end) end = in[1];
        else removed++;
    }
    return removed;
}
```

### Meeting Rooms II
**Category:** Tier 2 · Reinforce
**Pattern:** Min-heap of end times (or sweep line)  **Time:** O(n log n)  **Space:** O(n)
**Approach:** Sort meetings by start time and use a min-heap holding the end times of rooms currently in use. For each meeting, if the earliest-ending room is free by its start, reuse it (poll); otherwise allocate a new room. The heap size's peak is the answer.

<!-- Problem Statement not automatically found -->

```java
public int minMeetingRooms(int[][] intervals) {
    Arrays.sort(intervals, (a, b) -> Integer.compare(a[0], b[0]));
    PriorityQueue<Integer> heap = new PriorityQueue<>();
    for (int[] in : intervals) {
        if (!heap.isEmpty() && heap.peek() <= in[0]) heap.poll();
        heap.offer(in[1]);
    }
    return heap.size();
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
    List<int[]> res = new ArrayList<>();
    int i = 0, j = 0;
    while (i < A.length && j < B.length) {
        int lo = Math.max(A[i][0], B[j][0]);
        int hi = Math.min(A[i][1], B[j][1]);
        if (lo <= hi) res.add(new int[]{lo, hi});
        if (A[i][1] < B[j][1]) i++;
        else j++;
    }
    return res.toArray(new int[0][]);
}
```
