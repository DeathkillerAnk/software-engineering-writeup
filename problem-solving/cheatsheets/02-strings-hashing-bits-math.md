# 02 · Strings, Hashing, Bit Manipulation & Math

A pattern-first cheatsheet with clean, compilable Java for string manipulation, hashing, bit tricks, and number-theory problems.

---

## STRINGS

### Valid Anagram
**Category:** ⭐ Tier 1 · Core
**Pattern:** Frequency count  **Time:** O(n)  **Space:** O(1)
**Approach:** Two strings are anagrams iff they have identical character frequencies. Use a fixed-size count array (26 for lowercase letters), increment for the first string and decrement for the second. If every bucket ends at zero the strings match. Length mismatch is an immediate reject.
```java
class Solution {
    public boolean isAnagram(String s, String t) {
        if (s.length() != t.length()) return false;
        int[] count = new int[26];
        for (int i = 0; i < s.length(); i++) {
            count[s.charAt(i) - 'a']++;
            count[t.charAt(i) - 'a']--;
        }
        for (int c : count) if (c != 0) return false;
        return true;
    }
}
```
**Alternative(s):** For arbitrary Unicode, use a `HashMap<Character,Integer>` or sort both strings (O(n log n)).

### Group Anagrams
**Category:** ⭐ Tier 1 · Core
**Pattern:** Hashing by canonical key  **Time:** O(n·k log k)  **Space:** O(n·k)
**Approach:** Anagrams share a canonical form. Compute a key by sorting each string's characters (or by a 26-length count signature) and bucket strings by that key in a map. Each bucket's value list is one anagram group.
```java
import java.util.*;

class Solution {
    public List<List<String>> groupAnagrams(String[] strs) {
        Map<String, List<String>> map = new HashMap<>();
        for (String s : strs) {
            char[] arr = s.toCharArray();
            Arrays.sort(arr);
            String key = new String(arr);
            map.computeIfAbsent(key, k -> new ArrayList<>()).add(s);
        }
        return new ArrayList<>(map.values());
    }
}
```
**Alternative(s):** Build the key from a count array to get O(n·k) total: `count[0]#count[1]#...` avoids the sort.

### Find All Anagrams in a String
**Category:** Tier 2 · Reinforce
**Pattern:** Sliding window + frequency match  **Time:** O(n)  **Space:** O(1)
**Approach:** Slide a fixed window of length `p.length()` across `s`, maintaining a running count array. Track how many of the 26 buckets currently match the target counts. When all 26 match, the window start is an anagram index. Add/remove one character per step and update the match tally incrementally.
```java
import java.util.*;

class Solution {
    public List<Integer> findAnagrams(String s, String p) {
        List<Integer> res = new ArrayList<>();
        if (s.length() < p.length()) return res;
        int[] need = new int[26], win = new int[26];
        for (char c : p.toCharArray()) need[c - 'a']++;
        int k = p.length();
        for (int i = 0; i < s.length(); i++) {
            win[s.charAt(i) - 'a']++;
            if (i >= k) win[s.charAt(i - k) - 'a']--;
            if (i >= k - 1 && Arrays.equals(win, need)) res.add(i - k + 1);
        }
        return res;
    }
}
```

### Longest Palindromic Substring
**Category:** ⭐ Tier 1 · Core
**Pattern:** Expand around center  **Time:** O(n²)  **Space:** O(1)
**Approach:** Every palindrome has a center: either a single character (odd length) or a gap between two characters (even length). For each of the 2n-1 centers, expand outward while characters match and record the longest span found. This avoids the O(n²) space of DP.
```java
class Solution {
    public String longestPalindrome(String s) {
        if (s == null || s.isEmpty()) return "";
        int start = 0, end = 0;
        for (int i = 0; i < s.length(); i++) {
            int len1 = expand(s, i, i);
            int len2 = expand(s, i, i + 1);
            int len = Math.max(len1, len2);
            if (len > end - start + 1) {
                start = i - (len - 1) / 2;
                end = i + len / 2;
            }
        }
        return s.substring(start, end + 1);
    }

    private int expand(String s, int l, int r) {
        while (l >= 0 && r < s.length() && s.charAt(l) == s.charAt(r)) {
            l--; r++;
        }
        return r - l - 1;
    }
}
```
**Alternative(s):** Manacher's algorithm solves this in O(n) by transforming the string (insert separators like `#`) and reusing a symmetry array `P[]` around a running center/right boundary to avoid redundant re-expansion. It's the optimal solution but rarely needed in interviews; know that it exists and is O(n).

### Palindromic Substrings
**Category:** Tier 2 · Reinforce
**Pattern:** Expand around center (count)  **Time:** O(n²)  **Space:** O(1)
**Approach:** Same expand-around-center idea, but instead of tracking the longest, count every valid palindrome. Each successful expansion step (characters still match) contributes exactly one palindromic substring.
```java
class Solution {
    public int countSubstrings(String s) {
        int count = 0;
        for (int i = 0; i < s.length(); i++) {
            count += expand(s, i, i);
            count += expand(s, i, i + 1);
        }
        return count;
    }

    private int expand(String s, int l, int r) {
        int cnt = 0;
        while (l >= 0 && r < s.length() && s.charAt(l) == s.charAt(r)) {
            cnt++; l--; r++;
        }
        return cnt;
    }
}
```

### Valid Parentheses
**Category:** ⭐ Tier 1 · Core
**Pattern:** Stack matching  **Time:** O(n)  **Space:** O(n)
**Approach:** Push opening brackets onto a stack. On a closing bracket, the stack top must be the matching opener; otherwise the string is invalid. A valid string leaves the stack empty at the end.
```java
import java.util.*;

class Solution {
    public boolean isValid(String s) {
        Deque<Character> stack = new ArrayDeque<>();
        for (char c : s.toCharArray()) {
            if (c == '(') stack.push(')');
            else if (c == '[') stack.push(']');
            else if (c == '{') stack.push('}');
            else if (stack.isEmpty() || stack.pop() != c) return false;
        }
        return stack.isEmpty();
    }
}
```

### Decode String
**Category:** Tier 2 · Reinforce
**Pattern:** Two stacks (nested)  **Time:** O(n·maxK)  **Space:** O(n)
**Approach:** Parse left to right using one stack for repeat counts and one for the string built so far. On `[`, push the current number and accumulated string, then reset. On `]`, pop the count and previous string, and append the current segment repeated `count` times. Digits accumulate multi-digit numbers; letters append to the current segment.
```java
import java.util.*;

class Solution {
    public String decodeString(String s) {
        Deque<Integer> counts = new ArrayDeque<>();
        Deque<StringBuilder> strs = new ArrayDeque<>();
        StringBuilder cur = new StringBuilder();
        int num = 0;
        for (char c : s.toCharArray()) {
            if (Character.isDigit(c)) {
                num = num * 10 + (c - '0');
            } else if (c == '[') {
                counts.push(num);
                strs.push(cur);
                cur = new StringBuilder();
                num = 0;
            } else if (c == ']') {
                int k = counts.pop();
                StringBuilder prev = strs.pop();
                for (int i = 0; i < k; i++) prev.append(cur);
                cur = prev;
            } else {
                cur.append(c);
            }
        }
        return cur.toString();
    }
}
```

### Basic Calculator II
**Category:** Tier 2 · Reinforce
**Pattern:** Stack of terms (precedence)  **Time:** O(n)  **Space:** O(n)
**Approach:** Handle `+ - * /` without parentheses by tracking the last operator. Accumulate each number, then on the next operator (or end of string) apply the pending operator: push for `+`, push negated for `-`, or pop-and-combine for `*` `/`. The final answer is the sum of the stack.
```java
import java.util.*;

class Solution {
    public int calculate(String s) {
        Deque<Integer> stack = new ArrayDeque<>();
        int num = 0;
        char op = '+';
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (Character.isDigit(c)) num = num * 10 + (c - '0');
            if ((!Character.isDigit(c) && c != ' ') || i == s.length() - 1) {
                if (op == '+') stack.push(num);
                else if (op == '-') stack.push(-num);
                else if (op == '*') stack.push(stack.pop() * num);
                else if (op == '/') stack.push(stack.pop() / num);
                op = c;
                num = 0;
            }
        }
        int res = 0;
        while (!stack.isEmpty()) res += stack.pop();
        return res;
    }
}
```

### Simplify Path
**Category:** Tier 3 · Reference
**Pattern:** Stack of path components  **Time:** O(n)  **Space:** O(n)
**Approach:** Split the Unix path on `/`. Ignore empty components and `.`; on `..` pop the last directory if present; otherwise push the directory name. Join the stack with `/` and prepend a leading slash for the canonical absolute path.
```java
import java.util.*;

class Solution {
    public String simplifyPath(String path) {
        Deque<String> stack = new ArrayDeque<>();
        for (String part : path.split("/")) {
            if (part.isEmpty() || part.equals(".")) continue;
            if (part.equals("..")) {
                if (!stack.isEmpty()) stack.pop();
            } else {
                stack.push(part);
            }
        }
        StringBuilder sb = new StringBuilder();
        Iterator<String> it = stack.descendingIterator();
        while (it.hasNext()) sb.append('/').append(it.next());
        return sb.length() == 0 ? "/" : sb.toString();
    }
}
```

### Implement strStr / KMP
**Category:** ⭐ Tier 1 · Core
**Pattern:** Failure function (LPS array)  **Time:** O(n + m)  **Space:** O(m)
**Approach:** Build the longest-proper-prefix-that-is-also-suffix (LPS) array for the pattern, then scan the text without ever backing up the text pointer. On a mismatch, fall back the pattern pointer to `lps[j-1]` instead of restarting. The LPS build itself is a self-match of the pattern against its own prefix.
```java
class Solution {
    public int strStr(String haystack, String needle) {
        if (needle.isEmpty()) return 0;
        int[] lps = buildLps(needle);
        int i = 0, j = 0;
        while (i < haystack.length()) {
            if (haystack.charAt(i) == needle.charAt(j)) {
                i++; j++;
                if (j == needle.length()) return i - j;
            } else if (j > 0) {
                j = lps[j - 1];
            } else {
                i++;
            }
        }
        return -1;
    }

    private int[] buildLps(String p) {
        int[] lps = new int[p.length()];
        int len = 0, i = 1;
        while (i < p.length()) {
            if (p.charAt(i) == p.charAt(len)) {
                lps[i++] = ++len;
            } else if (len > 0) {
                len = lps[len - 1];
            } else {
                lps[i++] = 0;
            }
        }
        return lps;
    }
}
```
**Alternative(s):** Rabin-Karp uses a rolling hash for average O(n+m) but has hash-collision worst cases; the naive O(n·m) double loop is fine for short inputs.

### String Compression
**Category:** Tier 3 · Reference
**Pattern:** In-place two pointers  **Time:** O(n)  **Space:** O(1)
**Approach:** Use a read pointer to count consecutive runs and a write pointer to emit the character followed by the count digits (only when count > 1). Write in place into the same array and return the new logical length. Multi-digit counts are written digit by digit.
```java
class Solution {
    public int compress(char[] chars) {
        int write = 0, read = 0;
        while (read < chars.length) {
            char c = chars[read];
            int count = 0;
            while (read < chars.length && chars[read] == c) {
                read++; count++;
            }
            chars[write++] = c;
            if (count > 1) {
                for (char digit : Integer.toString(count).toCharArray()) {
                    chars[write++] = digit;
                }
            }
        }
        return write;
    }
}
```

### Reverse Words in a String
**Category:** Tier 2 · Reinforce
**Pattern:** Split / trim / reverse  **Time:** O(n)  **Space:** O(n)
**Approach:** Trim outer whitespace, split on one-or-more spaces to drop internal gaps, reverse the resulting word list, and join with single spaces. This normalizes messy spacing in one pass of tokenization.
```java
class Solution {
    public String reverseWords(String s) {
        String[] words = s.trim().split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (int i = words.length - 1; i >= 0; i--) {
            sb.append(words[i]);
            if (i > 0) sb.append(' ');
        }
        return sb.toString();
    }
}
```
**Alternative(s):** For O(1) extra space on a mutable char array: reverse the entire array, then reverse each word in place, then clean up spaces.

---

## HASHING

### Two Sum
**Category:** ⭐ Tier 1 · Core
**Pattern:** Complement hash map  **Time:** O(n)  **Space:** O(n)
**Approach:** For each number, check if its complement (`target - num`) has already been seen. Store each number's index in a map as you go; the first hit gives the answer pair in a single pass.
```java
import java.util.*;

class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> seen = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int need = target - nums[i];
            if (seen.containsKey(need)) return new int[]{seen.get(need), i};
            seen.put(nums[i], i);
        }
        return new int[]{-1, -1};
    }
}
```

### Contains Duplicate
**Category:** Tier 3 · Reference
**Pattern:** Set membership  **Time:** O(n)  **Space:** O(n)
**Approach:** Insert elements into a hash set; if an insertion fails (element already present) a duplicate exists. Early-return on the first collision.
```java
import java.util.*;

class Solution {
    public boolean containsDuplicate(int[] nums) {
        Set<Integer> seen = new HashSet<>();
        for (int n : nums) if (!seen.add(n)) return true;
        return false;
    }
}
```

### Longest Consecutive Sequence
**Category:** ⭐ Tier 1 · Core
**Pattern:** Hash set sequence-start scan  **Time:** O(n)  **Space:** O(n)
**Approach:** Put all numbers in a set. Only start counting a run from a number whose predecessor (`num-1`) is absent — that guarantees it's a sequence start. Walk upward counting consecutive members. Each number is visited at most twice, giving overall O(n).
```java
import java.util.*;

class Solution {
    public int longestConsecutive(int[] nums) {
        Set<Integer> set = new HashSet<>();
        for (int n : nums) set.add(n);
        int longest = 0;
        for (int n : set) {
            if (!set.contains(n - 1)) {
                int cur = n, length = 1;
                while (set.contains(cur + 1)) {
                    cur++; length++;
                }
                longest = Math.max(longest, length);
            }
        }
        return longest;
    }
}
```

### Isomorphic Strings
**Category:** Tier 2 · Reinforce
**Pattern:** Bidirectional mapping  **Time:** O(n)  **Space:** O(1)
**Approach:** A character in `s` must map to exactly one character in `t` and vice versa. Track both mappings; on any conflict with a previously recorded mapping, reject. Two arrays indexed by char code make the checks O(1).
```java
class Solution {
    public boolean isIsomorphic(String s, String t) {
        int[] mapST = new int[256], mapTS = new int[256];
        java.util.Arrays.fill(mapST, -1);
        java.util.Arrays.fill(mapTS, -1);
        for (int i = 0; i < s.length(); i++) {
            char a = s.charAt(i), b = t.charAt(i);
            if (mapST[a] == -1 && mapTS[b] == -1) {
                mapST[a] = b;
                mapTS[b] = a;
            } else if (mapST[a] != b || mapTS[b] != a) {
                return false;
            }
        }
        return true;
    }
}
```

### Word Pattern
**Category:** Tier 3 · Reference
**Pattern:** Bidirectional mapping  **Time:** O(n)  **Space:** O(n)
**Approach:** Same bijection idea as Isomorphic Strings but between pattern characters and whitespace-split words. Maintain char→word and word→char maps; any inconsistency or word-count mismatch fails. Both directions are required to reject cases like `"ab"` with words `["dog","dog"]`.
```java
import java.util.*;

class Solution {
    public boolean wordPattern(String pattern, String s) {
        String[] words = s.split(" ");
        if (pattern.length() != words.length) return false;
        Map<Character, String> c2w = new HashMap<>();
        Map<String, Character> w2c = new HashMap<>();
        for (int i = 0; i < words.length; i++) {
            char c = pattern.charAt(i);
            String w = words[i];
            if (c2w.containsKey(c) && !c2w.get(c).equals(w)) return false;
            if (w2c.containsKey(w) && w2c.get(w) != c) return false;
            c2w.put(c, w);
            w2c.put(w, c);
        }
        return true;
    }
}
```

---

## BIT MANIPULATION

### Bit Tricks Reference
**Category:** 🧩 Template
Handy identities used throughout the problems below:
```text
x & (x - 1)     clears the lowest set bit          (loop to count set bits)
x & -x          isolates the lowest set bit         (-x is ~x + 1)
x | (x + 1)     sets the lowest unset (0) bit
x & (x + 1)     clears trailing 1s
x ^ x           == 0                                (XOR self-cancels)
x ^ 0           == x
a ^ b ^ a       == b                                (XOR is its own inverse)
1 << k          mask with only bit k set
x & (1 << k)    tests bit k
x | (1 << k)    sets bit k
x & ~(1 << k)   clears bit k
x ^ (1 << k)    toggles bit k
(x >> k) & 1    reads bit k
x & 1           == 0  -> even ;  == 1 -> odd
(x & (x-1))==0  power of two check (for x > 0)
Integer.bitCount(x)            popcount
Integer.numberOfTrailingZeros(x)
>>> is logical (zero-fill) shift; >> is arithmetic (sign-extending) shift
```

### Single Number I
**Category:** ⭐ Tier 1 · Core
**Pattern:** XOR fold  **Time:** O(n)  **Space:** O(1)
**Approach:** Every element appears twice except one. XOR cancels pairs (`a ^ a = 0`) and leaves the unique element, since XOR is commutative and associative.
```java
class Solution {
    public int singleNumber(int[] nums) {
        int x = 0;
        for (int n : nums) x ^= n;
        return x;
    }
}
```

### Single Number II
**Category:** Tier 3 · Reference
**Pattern:** Bitwise state machine  **Time:** O(n)  **Space:** O(1)
**Approach:** Every element appears three times except one. Track two accumulators `ones` and `twos` representing bits seen once and twice (mod 3). Each bit cycles through 0→1→2→0 as duplicates arrive, so after processing, `ones` holds the unique number.
```java
class Solution {
    public int singleNumber(int[] nums) {
        int ones = 0, twos = 0;
        for (int n : nums) {
            ones = (ones ^ n) & ~twos;
            twos = (twos ^ n) & ~ones;
        }
        return ones;
    }
}
```
**Alternative(s):** Sum each of the 32 bit positions across all numbers; `sum % 3` reconstructs the unique number bit by bit. Clearer but O(32n).

### Single Number III
**Category:** Tier 3 · Reference
**Pattern:** XOR + lowest-set-bit partition  **Time:** O(n)  **Space:** O(1)
**Approach:** Two elements appear once; the rest twice. XOR all numbers to get `a ^ b`. Any set bit in that result differs between `a` and `b`; isolate the lowest set bit (`xor & -xor`) and use it to partition numbers into two groups, XORing each group separately to recover `a` and `b`.
```java
class Solution {
    public int[] singleNumber(int[] nums) {
        int xor = 0;
        for (int n : nums) xor ^= n;
        int diff = xor & -xor;
        int a = 0;
        for (int n : nums) if ((n & diff) != 0) a ^= n;
        return new int[]{a, xor ^ a};
    }
}
```

### Number of 1 Bits
**Category:** ⭐ Tier 1 · Core
**Pattern:** Clear-lowest-set-bit loop  **Time:** O(#bits set)  **Space:** O(1)
**Approach:** Repeatedly apply `n & (n - 1)`, which clears the lowest set bit each iteration. The number of iterations equals the population count. Use `>>>`/unsigned handling implicitly since the loop only touches set bits.
```java
class Solution {
    public int hammingWeight(int n) {
        int count = 0;
        while (n != 0) {
            n &= (n - 1);
            count++;
        }
        return count;
    }
}
```

### Counting Bits
**Category:** Tier 2 · Reinforce
**Pattern:** DP on bits  **Time:** O(n)  **Space:** O(n)
**Approach:** `bits[i] = bits[i >> 1] + (i & 1)`: dropping the lowest bit of `i` gives an already-computed smaller value, and the removed bit adds 0 or 1. This builds the full 0..n table in linear time.
```java
class Solution {
    public int[] countBits(int n) {
        int[] bits = new int[n + 1];
        for (int i = 1; i <= n; i++) {
            bits[i] = bits[i >> 1] + (i & 1);
        }
        return bits;
    }
}
```

### Reverse Bits
**Category:** Tier 3 · Reference
**Pattern:** Bit-by-bit shift and OR  **Time:** O(32)  **Space:** O(1)
**Approach:** Shift the result left, take the lowest bit of the input, OR it into the result, then shift the input right. After 32 iterations the bit order is fully reversed. Use `>>>` for the unsigned input shift.
```java
public class Solution {
    public int reverseBits(int n) {
        int result = 0;
        for (int i = 0; i < 32; i++) {
            result = (result << 1) | (n & 1);
            n >>>= 1;
        }
        return result;
    }
}
```

### Power of Two
**Category:** Tier 3 · Reference
**Pattern:** Clear-lowest-bit trick  **Time:** O(1)  **Space:** O(1)
**Approach:** A positive power of two has exactly one set bit, so `n & (n - 1)` is zero. Guard against non-positive inputs first.
```java
class Solution {
    public boolean isPowerOfTwo(int n) {
        return n > 0 && (n & (n - 1)) == 0;
    }
}
```

### Sum of Two Integers (without +)
**Category:** Tier 2 · Reinforce
**Pattern:** XOR + carry loop  **Time:** O(1)  **Space:** O(1)
**Approach:** XOR gives the sum without carries; AND-then-left-shift gives the carry bits. Repeat until there is no carry left. This is how a full adder works, expressed iteratively.
```java
class Solution {
    public int getSum(int a, int b) {
        while (b != 0) {
            int carry = (a & b) << 1;
            a = a ^ b;
            b = carry;
        }
        return a;
    }
}
```

### Subsets via Bitmask
**Category:** Tier 3 · Reference
**Pattern:** Enumerate 2^n masks  **Time:** O(n·2^n)  **Space:** O(n·2^n)
**Approach:** Each subset corresponds to an n-bit mask where bit `j` set means element `j` is included. Iterate all masks from 0 to 2^n − 1 and build the subset by testing each bit. Elegant when n is small (≤ ~20).
```java
import java.util.*;

class Solution {
    public List<List<Integer>> subsets(int[] nums) {
        int n = nums.length;
        List<List<Integer>> res = new ArrayList<>();
        for (int mask = 0; mask < (1 << n); mask++) {
            List<Integer> subset = new ArrayList<>();
            for (int j = 0; j < n; j++) {
                if ((mask & (1 << j)) != 0) subset.add(nums[j]);
            }
            res.add(subset);
        }
        return res;
    }
}
```
**Alternative(s):** Backtracking recursion produces the same power set and generalizes better to pruning/constraints.

---

## MATH / NUMBER THEORY

### Pow(x, n) — Fast Exponentiation
**Category:** ⭐ Tier 1 · Core
**Pattern:** Binary exponentiation  **Time:** O(log n)  **Space:** O(1)
**Approach:** Square the base while halving the exponent; multiply the result whenever the current exponent bit is set. Handle negative exponents by inverting the base and using a `long` for the exponent to avoid overflow when negating `Integer.MIN_VALUE`.
```java
class Solution {
    public double myPow(double x, int n) {
        long exp = n;
        if (exp < 0) {
            x = 1 / x;
            exp = -exp;
        }
        double result = 1.0;
        while (exp > 0) {
            if ((exp & 1) == 1) result *= x;
            x *= x;
            exp >>= 1;
        }
        return result;
    }
}
```

### Sqrt(x) — Binary Search
**Category:** Tier 2 · Reinforce
**Pattern:** Binary search on answer  **Time:** O(log x)  **Space:** O(1)
**Approach:** Search for the largest integer `m` with `m*m <= x`. Compare using `m <= x / m` to sidestep multiplication overflow. Narrow the range until it collapses on the floor of the square root.
```java
class Solution {
    public int mySqrt(int x) {
        if (x < 2) return x;
        int lo = 1, hi = x, ans = 0;
        while (lo <= hi) {
            int mid = lo + (hi - lo) / 2;
            if (mid <= x / mid) {
                ans = mid;
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
        return ans;
    }
}
```

### Happy Number
**Category:** Tier 3 · Reference
**Pattern:** Cycle detection (Floyd)  **Time:** O(log n)  **Space:** O(1)
**Approach:** Repeatedly replace the number with the sum of the squares of its digits. A happy number reaches 1; an unhappy one enters a cycle. Use fast/slow pointers to detect the loop without extra memory.
```java
class Solution {
    public boolean isHappy(int n) {
        int slow = n, fast = n;
        do {
            slow = square(slow);
            fast = square(square(fast));
        } while (slow != fast);
        return slow == 1;
    }

    private int square(int n) {
        int sum = 0;
        while (n > 0) {
            int d = n % 10;
            sum += d * d;
            n /= 10;
        }
        return sum;
    }
}
```
**Alternative(s):** A `HashSet` of seen values detects the cycle too, at O(log n) extra space.

### Excel Sheet Column Number
**Category:** Tier 3 · Reference
**Pattern:** Base-26 parse  **Time:** O(n)  **Space:** O(1)
**Approach:** Treat the title as a bijective base-26 number where A=1..Z=26. Fold left to right: `result = result * 26 + (char - 'A' + 1)`.
```java
class Solution {
    public int titleToNumber(String columnTitle) {
        int result = 0;
        for (char c : columnTitle.toCharArray()) {
            result = result * 26 + (c - 'A' + 1);
        }
        return result;
    }
}
```

### Excel Sheet Column Title
**Category:** Tier 3 · Reference
**Pattern:** Base-26 (bijective) build  **Time:** O(log n)  **Space:** O(n)
**Approach:** Convert a number to a bijective base-26 title. Because there is no zero digit, decrement by 1 before each `% 26` and `/ 26` step, then prepend the mapped letter. Build the string from least to most significant.
```java
class Solution {
    public String convertToTitle(int columnNumber) {
        StringBuilder sb = new StringBuilder();
        while (columnNumber > 0) {
            columnNumber--;
            sb.append((char) ('A' + columnNumber % 26));
            columnNumber /= 26;
        }
        return sb.reverse().toString();
    }
}
```

### Roman to Integer
**Category:** Tier 2 · Reinforce
**Pattern:** Subtractive scan  **Time:** O(n)  **Space:** O(1)
**Approach:** Map each numeral to its value. Scan left to right; if a symbol's value is less than the next symbol's value, subtract it (e.g. IV, IX), otherwise add it. This handles the six subtractive combinations naturally.
```java
class Solution {
    public int romanToInt(String s) {
        int[] val = new int[128];
        val['I'] = 1; val['V'] = 5; val['X'] = 10; val['L'] = 50;
        val['C'] = 100; val['D'] = 500; val['M'] = 1000;
        int total = 0;
        for (int i = 0; i < s.length(); i++) {
            int cur = val[s.charAt(i)];
            if (i + 1 < s.length() && cur < val[s.charAt(i + 1)]) {
                total -= cur;
            } else {
                total += cur;
            }
        }
        return total;
    }
}
```

### Integer to Roman
**Category:** Tier 2 · Reinforce
**Pattern:** Greedy with value table  **Time:** O(1)  **Space:** O(1)
**Approach:** Precompute values and symbols in descending order, including the subtractive forms (900=CM, 400=CD, 90=XC, etc.). Greedily subtract the largest fitting value and append its symbol until the number reaches zero.
```java
class Solution {
    public String intToRoman(int num) {
        int[] vals = {1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1};
        String[] syms = {"M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"};
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < vals.length; i++) {
            while (num >= vals[i]) {
                num -= vals[i];
                sb.append(syms[i]);
            }
        }
        return sb.toString();
    }
}
```

### GCD / LCM (Euclid)
**Category:** Tier 3 · Reference
**Pattern:** Euclidean algorithm  **Time:** O(log min(a,b))  **Space:** O(1)
**Approach:** `gcd(a, b) = gcd(b, a % b)` until the remainder is zero. LCM follows from `a / gcd(a,b) * b` — divide before multiplying to reduce overflow risk (use `long` for large inputs).
```java
class Solution {
    public long gcd(long a, long b) {
        while (b != 0) {
            long t = b;
            b = a % b;
            a = t;
        }
        return a;
    }

    public long lcm(long a, long b) {
        return a / gcd(a, b) * b;
    }
}
```

### Count Primes (Sieve of Eratosthenes)
**Category:** ⭐ Tier 1 · Core
**Pattern:** Sieve  **Time:** O(n log log n)  **Space:** O(n)
**Approach:** Mark multiples of each prime starting from its square as composite. Anything left unmarked below `n` is prime. Iterate `i` only up to `sqrt(n)` and start crossing out at `i*i` since smaller multiples were already handled by smaller primes.
```java
class Solution {
    public int countPrimes(int n) {
        if (n < 3) return 0;
        boolean[] composite = new boolean[n];
        int count = 0;
        for (int i = 2; i < n; i++) {
            if (!composite[i]) {
                count++;
                for (long j = (long) i * i; j < n; j += i) {
                    composite[(int) j] = true;
                }
            }
        }
        return count;
    }
}
```

### Reverse Integer (overflow handling)
**Category:** Tier 2 · Reinforce
**Pattern:** Digit pop with overflow guard  **Time:** O(log n)  **Space:** O(1)
**Approach:** Pop digits with `% 10` and push onto the reversed result. Before each push, check whether the multiply-and-add would exceed 32-bit `int` bounds; if so, return 0. This avoids relying on `long` and works for both positive and negative inputs.
```java
class Solution {
    public int reverse(int x) {
        int result = 0;
        while (x != 0) {
            int digit = x % 10;
            x /= 10;
            if (result > Integer.MAX_VALUE / 10 ||
                (result == Integer.MAX_VALUE / 10 && digit > 7)) return 0;
            if (result < Integer.MIN_VALUE / 10 ||
                (result == Integer.MIN_VALUE / 10 && digit < -8)) return 0;
            result = result * 10 + digit;
        }
        return result;
    }
}
```

### Palindrome Number
**Category:** Tier 3 · Reference
**Pattern:** Reverse half the digits  **Time:** O(log n)  **Space:** O(1)
**Approach:** Negatives and numbers ending in 0 (except 0 itself) are never palindromes. Build the reversed second half digit by digit and stop when it meets or passes the remaining first half. Compare the two halves, accounting for an odd middle digit.
```java
class Solution {
    public boolean isPalindrome(int x) {
        if (x < 0 || (x % 10 == 0 && x != 0)) return false;
        int reverted = 0;
        while (x > reverted) {
            reverted = reverted * 10 + x % 10;
            x /= 10;
        }
        return x == reverted || x == reverted / 10;
    }
}
```

### Multiply Strings
**Category:** Tier 3 · Reference
**Pattern:** Grade-school multiplication  **Time:** O(m·n)  **Space:** O(m+n)
**Approach:** Multiply each pair of digits and place the product into a result array where digits `i` and `j` contribute to positions `i+j` and `i+j+1`. Accumulate carries in a second pass, then strip leading zeros. This handles arbitrarily large numbers without overflow.
```java
class Solution {
    public String multiply(String num1, String num2) {
        if (num1.equals("0") || num2.equals("0")) return "0";
        int m = num1.length(), n = num2.length();
        int[] res = new int[m + n];
        for (int i = m - 1; i >= 0; i--) {
            for (int j = n - 1; j >= 0; j--) {
                int mul = (num1.charAt(i) - '0') * (num2.charAt(j) - '0');
                int p1 = i + j, p2 = i + j + 1;
                int sum = mul + res[p2];
                res[p2] = sum % 10;
                res[p1] += sum / 10;
            }
        }
        StringBuilder sb = new StringBuilder();
        for (int d : res) {
            if (!(sb.length() == 0 && d == 0)) sb.append(d);
        }
        return sb.length() == 0 ? "0" : sb.toString();
    }
}
```
