# DSA Master List & Java Cheatsheets

A complete map of data-structures & algorithms topics, the patterns that solve them,
and the canonical "unique" problems that teach each pattern. Every cheatsheet contains
the **approach** + **Java code** (with alternative solutions where they matter).

> How to use this repo: pick a pattern → learn the template → solve the 2–3 *signature*
> problems listed for it. If you can solve the signature problems, you own the pattern.
>
> **Short on time? Don't solve all 249.** Follow [STUDY-PLAN.md](STUDY-PLAN.md) — the
> **Core 55** touch every pattern once; a second tier adds the high-value variants.

---

## Cheatsheet Index

| # | Topic / Pattern Group | File |
|---|------------------------|------|
| 01 | Arrays · Two Pointers · Sliding Window · Prefix Sum | [cheatsheets/01-arrays-twopointers-sliding-prefix.md](cheatsheets/01-arrays-twopointers-sliding-prefix.md) |
| 02 | Strings · Hashing · Bit Manipulation · Math | [cheatsheets/02-strings-hashing-bits-math.md](cheatsheets/02-strings-hashing-bits-math.md) |
| 03 | Linked Lists · Stacks · Queues · Monotonic Stack · Intervals | [cheatsheets/03-linkedlist-stack-queue-intervals.md](cheatsheets/03-linkedlist-stack-queue-intervals.md) |
| 04 | Binary Search · Recursion · Backtracking | [cheatsheets/04-binarysearch-backtracking.md](cheatsheets/04-binarysearch-backtracking.md) |
| 05 | Trees · BST · Tries · Heaps / Priority Queue | [cheatsheets/05-trees-tries-heaps.md](cheatsheets/05-trees-tries-heaps.md) |
| 06 | Graphs · BFS/DFS · Topo Sort · Union-Find · Shortest Path · MST | [cheatsheets/06-graphs.md](cheatsheets/06-graphs.md) |
| 07 | Dynamic Programming (all sub-patterns) | [cheatsheets/07-dynamic-programming.md](cheatsheets/07-dynamic-programming.md) |
| 08 | Greedy · Advanced DS (Segment Tree · Fenwick · DSU) | [cheatsheets/08-greedy-advanced-ds.md](cheatsheets/08-greedy-advanced-ds.md) |

---

## The Complete Pattern Catalogue

### A. Array / Pointer patterns
1. **Two Pointers (opposite ends)** — Two Sum II, 3Sum, Container With Most Water, Trapping Rain Water, Valid Palindrome, Sort Colors (Dutch flag).
2. **Two Pointers (same direction / fast-slow on array)** — Remove Duplicates, Move Zeroes, Remove Element.
3. **Sliding Window (fixed size)** — Max Sum Subarray of size K, Max Average Subarray.
4. **Sliding Window (variable size)** — Longest Substring Without Repeating Chars, Minimum Window Substring, Longest Repeating Char Replacement, Fruit Into Baskets, Min Size Subarray Sum.
5. **Prefix Sum / Difference Array** — Subarray Sum Equals K, Range Sum Query, Product of Array Except Self, Range update (diff array), Pivot Index, Continuous Subarray Sum.
6. **Kadane / running aggregate** — Maximum Subarray, Maximum Product Subarray, Best Time to Buy/Sell Stock.
7. **Cyclic Sort (1..n values)** — Missing Number, Find All Duplicates, First Missing Positive, Find the Duplicate Number.
8. **Merge Intervals** — Merge Intervals, Insert Interval, Non-overlapping Intervals, Meeting Rooms I/II, Interval List Intersections.

### B. String patterns
9. **Frequency counting / anagrams** — Valid Anagram, Group Anagrams, Find All Anagrams in a String.
10. **Palindrome (expand around center / DP)** — Longest Palindromic Substring, Palindromic Substrings, Valid Palindrome.
11. **String parsing / stack** — Valid Parentheses, Decode String, Basic Calculator, Simplify Path.
12. **Pattern matching** — Implement strStr (KMP), Repeated Substring Pattern, Rabin-Karp.
13. **Encoding / two-pointer string** — String Compression, Reverse Words, Zigzag Conversion.

### C. Hashing
14. **Hash map lookups** — Two Sum, Contains Duplicate, Longest Consecutive Sequence, Isomorphic Strings, Word Pattern.
15. **Hashing + design** — LRU Cache, Insert Delete GetRandom O(1), Time-Based Key-Value Store.

### D. Bit Manipulation & Math
16. **Bit tricks** — Single Number I/II/III, Number of 1 Bits, Counting Bits, Reverse Bits, Power of Two, Sum of Two Integers (no +), Missing Number (XOR), Subsets via bitmask.
17. **Math / number theory** — Pow(x,n), Sqrt(x), Happy Number, Excel Column, Roman↔Integer, GCD/LCM, Sieve of Eratosthenes (Count Primes), Reverse Integer, Palindrome Number, Multiply Strings.

### E. Linked List
18. **Fast & Slow pointers** — Linked List Cycle I/II, Middle of List, Happy Number, Palindrome Linked List.
19. **In-place reversal** — Reverse Linked List, Reverse Nodes in k-Group, Reverse between m..n, Rotate List, Swap Nodes in Pairs.
20. **Merge / manipulate** — Merge Two Sorted Lists, Add Two Numbers, Remove Nth From End, Reorder List, Copy List with Random Pointer, Flatten Multilevel List.

### F. Stack / Queue
21. **Monotonic stack** — Next Greater Element, Daily Temperatures, Largest Rectangle in Histogram, Trapping Rain Water, Stock Span, Remove K Digits.
22. **Stack design** — Min Stack, Implement Queue using Stacks, Implement Stack using Queues.
23. **Monotonic deque** — Sliding Window Maximum, Shortest Subarray with Sum ≥ K.

### G. Search
24. **Binary search (sorted array)** — Binary Search, Search Insert Position, First/Last Position, Search in Rotated Sorted Array, Find Minimum in Rotated Array.
25. **Binary search on answer** — Koko Eating Bananas, Capacity to Ship Packages, Split Array Largest Sum, Median of Two Sorted Arrays, Minimize Max Distance.
26. **Binary search on 2D / matrix** — Search a 2D Matrix I/II.

### H. Recursion / Backtracking
27. **Subsets / combinations / permutations** — Subsets I/II, Permutations I/II, Combinations, Combination Sum I/II, Letter Combinations of Phone Number.
28. **Grid backtracking** — N-Queens, Sudoku Solver, Word Search, Rat in a Maze.
29. **Partition / string backtracking** — Palindrome Partitioning, Restore IP Addresses, Generate Parentheses.

### I. Trees
30. **DFS traversals** — Pre/In/Post-order (recursive + iterative), Morris traversal.
31. **BFS / level order** — Level Order, Zigzag Level Order, Right Side View, Average of Levels.
32. **Tree DFS recursion (divide & conquer)** — Max Depth, Diameter, Balanced Tree, Path Sum I/II/III, Lowest Common Ancestor, Max Path Sum.
33. **BST** — Validate BST, Insert/Delete BST, Kth Smallest, BST Iterator, Convert Sorted Array to BST, Inorder Successor.
34. **Tree construction / serialization** — Build from Preorder+Inorder, Serialize/Deserialize, Flatten Tree to List.
35. **Trie** — Implement Trie, Word Search II, Add & Search Word, Replace Words, Maximum XOR (binary trie).

### J. Heap / Priority Queue
36. **Top-K elements** — Kth Largest Element, Top K Frequent, K Closest Points, Sort Characters by Frequency.
37. **Two heaps** — Find Median from Data Stream, Sliding Window Median, IPO.
38. **K-way merge** — Merge K Sorted Lists, Smallest Range Covering K Lists, Kth Smallest in Sorted Matrix.
39. **Scheduling / greedy heap** — Task Scheduler, Reorganize String, Meeting Rooms II, Minimum Cost to Connect Sticks.

### K. Graphs
40. **Graph traversal** — Number of Islands, Flood Fill, Clone Graph, Number of Connected Components, Surrounded Regions, Pacific Atlantic.
41. **BFS shortest path (unweighted)** — Word Ladder, Rotting Oranges, 01 Matrix, Shortest Path in Binary Matrix, Open the Lock.
42. **Topological sort** — Course Schedule I/II, Alien Dictionary, Minimum Height Trees, Parallel Courses.
43. **Union-Find / DSU** — Number of Provinces, Redundant Connection, Accounts Merge, Number of Islands II, Graph Valid Tree.
44. **Shortest path (weighted)** — Dijkstra (Network Delay Time, Cheapest Flights), Bellman-Ford, Floyd-Warshall.
45. **Minimum Spanning Tree** — Kruskal & Prim (Min Cost to Connect All Points, Connecting Cities).
46. **Advanced graph** — Bipartite Check, Bridges & Articulation Points (Tarjan), Strongly Connected Components, Eulerian Path (Reconstruct Itinerary).

### L. Dynamic Programming
47. **1-D / Fibonacci-style** — Climbing Stairs, House Robber I/II, Decode Ways, Min Cost Climbing Stairs.
48. **0/1 Knapsack family** — Partition Equal Subset Sum, Target Sum, Last Stone Weight II, Subset Sum.
49. **Unbounded knapsack** — Coin Change I/II, Combination Sum IV, Rod Cutting, Minimum Cost for Tickets.
50. **Subsequence DP** — Longest Increasing Subsequence, Longest Common Subsequence, Edit Distance, Distinct Subsequences, Longest Palindromic Subsequence.
51. **String/Interval DP** — Matrix Chain, Burst Balloons, Palindrome Partitioning II, Minimum Cost to Cut a Stick, Stone Game.
52. **Grid DP** — Unique Paths I/II, Minimum Path Sum, Dungeon Game, Maximal Square, Cherry Pickup.
53. **DP on stocks** — Best Time to Buy/Sell Stock II/III/IV, with Cooldown, with Transaction Fee.
54. **Bitmask DP** — Travelling Salesman, Partition to K Equal Sum Subsets, Shortest Superstring.
55. **DP on trees** — House Robber III, Binary Tree Cameras, Diameter via DP.
56. **Digit DP / Probability DP** — Count numbers with constraints, Knight Probability, Soup Servings.

### M. Greedy
57. **Interval / scheduling greedy** — Jump Game I/II, Gas Station, Non-overlapping Intervals, Minimum Arrows to Burst Balloons, Partition Labels.
58. **Sorting-based greedy** — Assign Cookies, Two City Scheduling, Queue Reconstruction by Height, Candy.

### N. Advanced Data Structures
59. **Segment Tree** — Range Sum/Min/Max Query (mutable), Range update with lazy propagation, Count of Smaller Numbers After Self.
60. **Fenwick / Binary Indexed Tree** — Range Sum Query Mutable, Reverse Pairs, Inversions count.
61. **Disjoint Set Union (with rank + path compression)** — see Union-Find problems above.
62. **Design** — LFU Cache, Design Twitter, Skiplist, Randomized Set, Snake Game.

---

## Complexity quick-reference

| Structure | Access | Search | Insert | Delete |
|-----------|--------|--------|--------|--------|
| Array | O(1) | O(n) | O(n) | O(n) |
| Dynamic Array (ArrayList) | O(1) | O(n) | O(1)* | O(n) |
| Hash Table (HashMap) | – | O(1)* | O(1)* | O(1)* |
| Balanced BST (TreeMap) | – | O(log n) | O(log n) | O(log n) |
| Heap (PriorityQueue) | O(1) peek | O(n) | O(log n) | O(log n) |
| Linked List | O(n) | O(n) | O(1) | O(1) |
| Trie | – | O(L) | O(L) | O(L) |
| Segment Tree / Fenwick | – | O(log n) | O(log n) | O(log n) |

\* amortized / average.

| Sort | Time | Space | Stable |
|------|------|-------|--------|
| QuickSort | O(n log n) avg, O(n²) worst | O(log n) | No |
| MergeSort | O(n log n) | O(n) | Yes |
| HeapSort | O(n log n) | O(1) | No |
| Counting/Radix | O(n + k) | O(n + k) | Yes |
| `Arrays.sort` (primitives) | dual-pivot quicksort | – | No |
| `Arrays.sort` (objects) / `Collections.sort` | Timsort | O(n) | Yes |
