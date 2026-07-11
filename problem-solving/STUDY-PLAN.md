# Study Plan — Cover Every Pattern in the Fewest Problems

The 249 problems exist for reference. You don't solve them all. **Solve Tier 1 (55 problems)
and you will have touched every pattern at least once.** Tier 2 adds the high-value variants
that show up constantly in interviews. Tier 3 is "only if you have time / targeting hard rounds."

- **Tier 1 — Core 55:** one representative per pattern. Do these first, in order.
- **Tier 2 — +45 Reinforce:** second variant or harder twist on a pattern you already learned.
- **Tier 3 — the rest (~150):** extra practice; skip unless prepping for a specific hard bar.

Cheatsheet column tells you where the full approach + Java lives.

---

## TIER 1 — Core 55 (do these first)

### Arrays / Pointers  → [01](cheatsheets/01-arrays-twopointers-sliding-prefix.md)
| # | Problem | Pattern it teaches |
|---|---------|--------------------|
| 1 | Two Sum | Hash-map lookup (the baseline) |
| 2 | Best Time to Buy and Sell Stock | Running min / one-pass scan |
| 3 | 3Sum | Two pointers on sorted array |
| 4 | Container With Most Water | Two pointers, opposite ends |
| 5 | Trapping Rain Water | Two pointers + precomputed max |
| 6 | Sort Colors | Dutch National Flag (3-way partition) |
| 7 | Maximum Subarray | Kadane |
| 8 | Product of Array Except Self | Prefix / suffix products |
| 9 | Subarray Sum Equals K | Prefix sum + hashmap |
| 10 | Find All Numbers Disappeared / Missing Number | Cyclic sort (index as hash) |
| 11 | Merge Intervals | Sort + sweep intervals |

### Sliding Window  → [01](cheatsheets/01-arrays-twopointers-sliding-prefix.md)
| # | Problem | Pattern it teaches |
|---|---------|--------------------|
| 12 | Longest Substring Without Repeating Characters | Variable window |
| 13 | Minimum Window Substring | Variable window + need/have counts |
| 14 | Maximum Sum Subarray of Size K | Fixed window |

### Strings / Hashing  → [02](cheatsheets/02-strings-hashing-bits-math.md)
| # | Problem | Pattern it teaches |
|---|---------|--------------------|
| 15 | Valid Anagram | Frequency counting |
| 16 | Group Anagrams | Canonical-key hashing |
| 17 | Longest Palindromic Substring | Expand around center |
| 18 | Valid Parentheses | Stack matching |
| 19 | Longest Consecutive Sequence | Hash-set sequence walk |
| 20 | Implement strStr (KMP) | String matching / failure function |

### Bit / Math  → [02](cheatsheets/02-strings-hashing-bits-math.md)
| # | Problem | Pattern it teaches |
|---|---------|--------------------|
| 21 | Single Number | XOR trick |
| 22 | Number of 1 Bits | Bit counting (`n & (n-1)`) |
| 23 | Pow(x, n) | Fast exponentiation |
| 24 | Count Primes | Sieve of Eratosthenes |

### Linked List  → [03](cheatsheets/03-linkedlist-stack-queue-intervals.md)
| # | Problem | Pattern it teaches |
|---|---------|--------------------|
| 25 | Reverse Linked List | In-place pointer reversal |
| 26 | Linked List Cycle II | Fast & slow pointers (find start) |
| 27 | Merge Two Sorted Lists | Two-pointer merge |
| 28 | Remove Nth Node From End | Two-pointer gap |
| 29 | Reverse Nodes in k-Group | Reversal in segments (hard-but-core) |

### Stack / Queue  → [03](cheatsheets/03-linkedlist-stack-queue-intervals.md)
| # | Problem | Pattern it teaches |
|---|---------|--------------------|
| 30 | Daily Temperatures | Monotonic stack |
| 31 | Largest Rectangle in Histogram | Monotonic stack (advanced) |
| 32 | Sliding Window Maximum | Monotonic deque |
| 33 | Min Stack | Stack design |

### Binary Search  → [04](cheatsheets/04-binarysearch-backtracking.md)
| # | Problem | Pattern it teaches |
|---|---------|--------------------|
| 34 | Binary Search | The template |
| 35 | Search in Rotated Sorted Array | Modified binary search |
| 36 | Koko Eating Bananas | Binary search on the answer |
| 37 | Find First and Last Position | lower/upper bound |

### Backtracking  → [04](cheatsheets/04-binarysearch-backtracking.md)
| # | Problem | Pattern it teaches |
|---|---------|--------------------|
| 38 | Subsets | Include/exclude recursion |
| 39 | Permutations | Backtracking with used[] |
| 40 | Combination Sum | Choose-with-repetition backtracking |
| 41 | Word Search | Grid backtracking + DFS |

### Trees  → [05](cheatsheets/05-trees-tries-heaps.md)
| # | Problem | Pattern it teaches |
|---|---------|--------------------|
| 42 | Level Order Traversal | BFS on tree |
| 43 | Maximum Depth of Binary Tree | DFS recursion |
| 44 | Lowest Common Ancestor (Binary Tree) | Divide & conquer on tree |
| 45 | Validate Binary Search Tree | BST invariant |
| 46 | Kth Smallest Element in a BST | Inorder traversal |
| 47 | Serialize and Deserialize Binary Tree | Tree encoding |
| 48 | Implement Trie | Prefix tree |

### Heaps  → [05](cheatsheets/05-trees-tries-heaps.md)
| # | Problem | Pattern it teaches |
|---|---------|--------------------|
| 49 | Top K Frequent Elements | Heap / bucket for top-K |
| 50 | Find Median from Data Stream | Two heaps |
| 51 | Merge k Sorted Lists | K-way merge |

### Graphs  → [06](cheatsheets/06-graphs.md)
| # | Problem | Pattern it teaches |
|---|---------|--------------------|
| 52 | Number of Islands | Grid DFS/BFS flood fill |
| 53 | Course Schedule | Topological sort (cycle detect) |
| 54 | Rotting Oranges | Multi-source BFS |
| 55 | Number of Provinces | Union-Find (DSU) |
| 56 | Network Delay Time | Dijkstra (weighted shortest path) |

### Dynamic Programming  → [07](cheatsheets/07-dynamic-programming.md)
| # | Problem | Pattern it teaches |
|---|---------|--------------------|
| 57 | Climbing Stairs | 1-D Fibonacci DP |
| 58 | House Robber | 1-D pick/skip DP |
| 59 | Coin Change | Unbounded knapsack (min) |
| 60 | Partition Equal Subset Sum | 0/1 knapsack |
| 61 | Longest Increasing Subsequence | Subsequence DP (+ O(n log n)) |
| 62 | Longest Common Subsequence | 2-D grid DP |
| 63 | Edit Distance | 2-D string DP |
| 64 | Unique Paths | Grid counting DP |

### Greedy  → [08](cheatsheets/08-greedy-advanced-ds.md)
| # | Problem | Pattern it teaches |
|---|---------|--------------------|
| 65 | Jump Game | Greedy reachability |
| 66 | Non-overlapping Intervals | Interval-scheduling greedy |

> That's the full pattern surface. (Count runs to ~66 because a few categories genuinely
> need 2 anchors — trees and DP each carry several distinct patterns. If you want a hard
> cap of exactly 55, drop #5, #29, #31, #47, #56, and one of the DP grid problems — you'll
> still touch every *family*, just with less redundancy.)

---

## TIER 2 — +45 Reinforce (do after Tier 1)

These are the "you'll see this again" variants worth a second rep on a pattern you know.

- **Arrays/Window:** Two Sum II, Longest Repeating Character Replacement, Minimum Size Subarray Sum, Maximum Product Subarray, First Missing Positive, Insert Interval, Meeting Rooms II.
- **Strings:** Find All Anagrams in a String, Palindromic Substrings, Decode String, Basic Calculator II, Reverse Words in a String, Isomorphic Strings.
- **Bit/Math:** Counting Bits, Sum of Two Integers, Sqrt(x), Roman↔Integer, Reverse Integer.
- **Linked List:** Linked List Cycle (I), Add Two Numbers, Reorder List, Copy List with Random Pointer, Palindrome Linked List.
- **Stack:** Next Greater Element I, Remove K Digits, Implement Queue using Stacks.
- **Binary Search:** Find Minimum in Rotated Sorted Array, Search a 2D Matrix, Median of Two Sorted Arrays, Capacity to Ship Packages.
- **Backtracking:** Subsets II, Permutations II, Generate Parentheses, Palindrome Partitioning, Letter Combinations, N-Queens.
- **Trees:** Diameter of Binary Tree, Binary Tree Maximum Path Sum, Right Side View, Construct from Preorder & Inorder, Invert Binary Tree, Word Search II.
- **Heaps:** Kth Largest Element, K Closest Points to Origin, Task Scheduler.
- **Graphs:** Clone Graph, Pacific Atlantic Water Flow, Course Schedule II, Word Ladder, Redundant Connection, Min Cost to Connect All Points, Cheapest Flights Within K Stops.

---

## TIER 3 — Everything else (~150)

Reference material in the cheatsheets. Reach for these only when (a) a specific company/round
demands hard variants (Burst Balloons, Alien Dictionary, Reconstruct Itinerary, LFU Cache,
Segment Tree / Fenwick problems, Bitmask DP / TSP), or (b) you want extra reps on a weak area.

---

## Suggested schedule

| Pace | Plan |
|------|------|
| 2 weeks (intense) | Tier 1 (~5/day) → then Tier 2 |
| 4 weeks (steady) | Tier 1 in wk 1–2, Tier 2 in wk 3–4 |
| Interview in 3 days | Tier 1 categories most relevant to the role only |

Rule of thumb: if you can re-derive a Tier-1 solution from scratch a day later without
looking, that pattern is owned — move on. Don't re-solve what you already know.
