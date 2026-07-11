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
