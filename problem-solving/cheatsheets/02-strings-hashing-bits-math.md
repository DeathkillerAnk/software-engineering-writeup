# 02 · Strings, Hashing, Bit Manipulation & Math

A pattern-first cheatsheet with clean, compilable Java for string manipulation, hashing, bit tricks, and number-theory problems.

---

## STRINGS

### Valid Anagram

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Valid Anagram](https://leetcode.com/problems/valid-anagram/)


Given two strings `s` and `t`, return `true` if `t` is an <span data-keyword="anagram">anagram</span> of `s`, and `false` otherwise.

 

<strong class="example">Example 1:</strong>

<div class="example-block">

**Input:** <span class="example-io">s = "anagram", t = "nagaram"</span>

**Output:** <span class="example-io">true</span>
</div>

<strong class="example">Example 2:</strong>

<div class="example-block">

**Input:** <span class="example-io">s = "rat", t = "car"</span>

**Output:** <span class="example-io">false</span>
</div>

 

**Constraints:**

	- `1 <= s.length, t.length <= 5 * 10<sup>4</sup>`

	- `s` and `t` consist of lowercase English letters.

 

**Follow up:** What if the inputs contain Unicode characters? How would you adapt your solution to such a case?

</details>

**Category:** ⭐ Tier 1 · Core
**Pattern:** Frequency count  **Time:** O(n)  **Space:** O(1)
**Approach:** Two strings are anagrams iff they have identical character frequencies. Use a fixed-size count array (26 for lowercase letters), increment for the first string and decrement for the second. If every bucket ends at zero the strings match. Length mismatch is an immediate reject.


```java
class Solution {
    public boolean isAnagram(String s, String t) {
        // If the lengths are different, they cannot be anagrams
        if (s.length() != t.length()) return false;
        
        // Array to store the frequency of each of the 26 lowercase letters
        int[] count = new int[26];
        
        // Iterate through both strings simultaneously
        for (int i = 0; i < s.length(); i++) {
            // Increment the count for the character in string s
            count[s.charAt(i) - 'a']++;
            // Decrement the count for the character in string t
            count[t.charAt(i) - 'a']--;
        }
        
        // Check if any character has a non-zero frequency difference
        for (int c : count) {
            // If we find a non-zero count, the strings are not anagrams
            if (c != 0) return false;
        }
        
        // All frequencies matched, so they are anagrams
        return true;
    }
}
```
**Alternative(s):** For arbitrary Unicode, use a `HashMap<Character,Integer>` or sort both strings (O(n log n)).

### Group Anagrams

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Group Anagrams](https://leetcode.com/problems/group-anagrams/)


Given an array of strings `strs`, group the <span data-keyword="anagram">anagrams</span> together. You can return the answer in **any order**.

 

<strong class="example">Example 1:</strong>

<div class="example-block">

**Input:** <span class="example-io">strs = ["eat","tea","tan","ate","nat","bat"]</span>

**Output:** <span class="example-io">[["bat"],["nat","tan"],["ate","eat","tea"]]</span>

**Explanation:**

	- There is no string in strs that can be rearranged to form `"bat"`.

	- The strings `"nat"` and `"tan"` are anagrams as they can be rearranged to form each other.

	- The strings `"ate"`, `"eat"`, and `"tea"` are anagrams as they can be rearranged to form each other.

</div>

<strong class="example">Example 2:</strong>

<div class="example-block">

**Input:** <span class="example-io">strs = [""]</span>

**Output:** <span class="example-io">[[""]]</span>
</div>

<strong class="example">Example 3:</strong>

<div class="example-block">

**Input:** <span class="example-io">strs = ["a"]</span>

**Output:** <span class="example-io">[["a"]]</span>
</div>

 

**Constraints:**

	- `1 <= strs.length <= 10<sup>4</sup>`

	- `0 <= strs[i].length <= 100`

	- `strs[i]` consists of lowercase English letters.

</details>

**Category:** ⭐ Tier 1 · Core
**Pattern:** Hashing by canonical key  **Time:** O(n·k log k)  **Space:** O(n·k)
**Approach:** Anagrams share a canonical form. Compute a key by sorting each string's characters (or by a 26-length count signature) and bucket strings by that key in a map. Each bucket's value list is one anagram group.


```java
import java.util.*;

class Solution {
    public List<List<String>> groupAnagrams(String[] strs) {
        // Map to group strings by their sorted character sequence
        Map<String, List<String>> map = new HashMap<>();
        
        // Iterate over each string in the input array
        for (String s : strs) {
            // Convert the string to a character array for sorting
            char[] arr = s.toCharArray();
            // Sort the array so that anagrams become identical
            Arrays.sort(arr);
            // Create a string from the sorted array to use as the map key
            String key = new String(arr);
            
            // If the key doesn't exist, create a new list for it, then add the original string
            map.computeIfAbsent(key, k -> new ArrayList<>()).add(s);
        }
        
        // Return all the grouped anagram lists as a new List
        return new ArrayList<>(map.values());
    }
}
```
**Alternative(s):** Build the key from a count array to get O(n·k) total: `count[0]#count[1]#...` avoids the sort.

### Find All Anagrams in a String

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Find All Anagrams in a String](https://leetcode.com/problems/find-all-anagrams-in-a-string/)


Given two strings `s` and `p`, return an array of all the start indices of `p`'s <span data-keyword="anagram">anagrams</span> in `s`. You may return the answer in **any order**.

 

<strong class="example">Example 1:</strong>

```text

**Input:** s = "cbaebabacd", p = "abc"
**Output:** [0,6]
**Explanation:**
The substring with start index = 0 is "cba", which is an anagram of "abc".
The substring with start index = 6 is "bac", which is an anagram of "abc".

```

<strong class="example">Example 2:</strong>

```text

**Input:** s = "abab", p = "ab"
**Output:** [0,1,2]
**Explanation:**
The substring with start index = 0 is "ab", which is an anagram of "ab".
The substring with start index = 1 is "ba", which is an anagram of "ab".
The substring with start index = 2 is "ab", which is an anagram of "ab".

```

 

**Constraints:**

	- `1 <= s.length, p.length <= 3 * 10<sup>4</sup>`

	- `s` and `p` consist of lowercase English letters.

</details>

**Category:** Tier 2 · Reinforce
**Pattern:** Sliding window + frequency match  **Time:** O(n)  **Space:** O(1)
**Approach:** Slide a fixed window of length `p.length()` across `s`, maintaining a running count array. Track how many of the 26 buckets currently match the target counts. When all 26 match, the window start is an anagram index. Add/remove one character per step and update the match tally incrementally.


```java
import java.util.*;

class Solution {
    public List<Integer> findAnagrams(String s, String p) {
        // List to hold the starting indices of all anagrams found
        List<Integer> res = new ArrayList<>();
        // If the search string is shorter than the pattern, no anagram is possible
        if (s.length() < p.length()) return res;
        
        // Arrays to count frequency of characters in pattern (need) and current window (win)
        int[] need = new int[26], win = new int[26];
        
        // Populate the frequency array for the pattern string
        for (char c : p.toCharArray()) need[c - 'a']++;
        
        // Store the length of the pattern for easy access
        int k = p.length();
        
        // Slide a window over the search string s
        for (int i = 0; i < s.length(); i++) {
            // Add the current character to the window's frequency count
            win[s.charAt(i) - 'a']++;
            
            // If the window size exceeds the pattern length, remove the oldest character
            if (i >= k) win[s.charAt(i - k) - 'a']--;
            
            // If the window has reached the pattern length and frequencies match, record the start index
            if (i >= k - 1 && Arrays.equals(win, need)) res.add(i - k + 1);
        }
        
        // Return the list of starting indices
        return res;
    }
}
```

### Longest Palindromic Substring

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Longest Palindromic Substring](https://leetcode.com/problems/longest-palindromic-substring/)


Given a string `s`, return *the longest* <span data-keyword="palindromic-string">*palindromic*</span> <span data-keyword="substring-nonempty">*substring*</span> in `s`.

 

<strong class="example">Example 1:</strong>

```text

**Input:** s = "babad"
**Output:** "bab"
**Explanation:** "aba" is also a valid answer.

```

<strong class="example">Example 2:</strong>

```text

**Input:** s = "cbbd"
**Output:** "bb"

```

 

**Constraints:**

	- `1 <= s.length <= 1000`

	- `s` consist of only digits and English letters.

</details>

**Category:** ⭐ Tier 1 · Core
**Pattern:** Expand around center  **Time:** O(n²)  **Space:** O(1)
**Approach:** Every palindrome has a center: either a single character (odd length) or a gap between two characters (even length). For each of the 2n-1 centers, expand outward while characters match and record the longest span found. This avoids the O(n²) space of DP.


```java
class Solution {
    public String longestPalindrome(String s) {
        // Handle empty or null string gracefully
        if (s == null || s.isEmpty()) return "";
        
        // Variables to keep track of the start and end indices of the longest palindrome
        int start = 0, end = 0;
        
        // Iterate through each character, treating it as the potential center of a palindrome
        for (int i = 0; i < s.length(); i++) {
            // Check for odd-length palindromes (center is a single character)
            int len1 = expand(s, i, i);
            // Check for even-length palindromes (center is between two characters)
            int len2 = expand(s, i, i + 1);
            
            // Take the maximum length found from both center types
            int len = Math.max(len1, len2);
            
            // If we found a longer palindrome, update our start and end indices
            if (len > end - start + 1) {
                // Calculate the new start index based on the center and length
                start = i - (len - 1) / 2;
                // Calculate the new end index based on the center and length
                end = i + len / 2;
            }
        }
        
        // Return the longest palindromic substring
        return s.substring(start, end + 1);
    }

    // Helper method to expand around a center and return the length of the palindrome
    private int expand(String s, int l, int r) {
        // Continue expanding as long as characters match and indices are in bounds
        while (l >= 0 && r < s.length() && s.charAt(l) == s.charAt(r)) {
            // Move the left pointer outwards
            l--; 
            // Move the right pointer outwards
            r++;
        }
        // Return the length of the matching portion (r - l - 1 adjusts for the last failing step)
        return r - l - 1;
    }
}
```
**Alternative(s):** Manacher's algorithm solves this in O(n) by transforming the string (insert separators like `#`) and reusing a symmetry array `P[]` around a running center/right boundary to avoid redundant re-expansion. It's the optimal solution but rarely needed in interviews; know that it exists and is O(n).

### Palindromic Substrings

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Palindromic Substrings](https://leetcode.com/problems/palindromic-substrings/)


Given a string `s`, return *the number of **palindromic substrings** in it*.

A string is a **palindrome** when it reads the same backward as forward.

A **substring** is a contiguous sequence of characters within the string.

 

<strong class="example">Example 1:</strong>

```text

**Input:** s = "abc"
**Output:** 3
**Explanation:** Three palindromic strings: "a", "b", "c".

```

<strong class="example">Example 2:</strong>

```text

**Input:** s = "aaa"
**Output:** 6
**Explanation:** Six palindromic strings: "a", "a", "a", "aa", "aa", "aaa".

```

 

**Constraints:**

	- `1 <= s.length <= 1000`

	- `s` consists of lowercase English letters.

</details>

**Category:** Tier 2 · Reinforce
**Pattern:** Expand around center (count)  **Time:** O(n²)  **Space:** O(1)
**Approach:** Same expand-around-center idea, but instead of tracking the longest, count every valid palindrome. Each successful expansion step (characters still match) contributes exactly one palindromic substring.


```java
class Solution {
    public int countSubstrings(String s) {
        // Variable to keep a running total of all palindromic substrings
        int count = 0;
        
        // Iterate over each possible center of a palindrome
        for (int i = 0; i < s.length(); i++) {
            // Add palindromes centered at a single character (odd length)
            count += expand(s, i, i);
            // Add palindromes centered between two characters (even length)
            count += expand(s, i, i + 1);
        }
        
        // Return the total number of palindromic substrings found
        return count;
    }

    // Helper method to expand outwards and count valid palindromes
    private int expand(String s, int l, int r) {
        // Counter for palindromes found during this expansion
        int cnt = 0;
        
        // Expand outwards while indices are valid and characters match
        while (l >= 0 && r < s.length() && s.charAt(l) == s.charAt(r)) {
            // Increment the count for each valid expansion step
            cnt++; 
            // Move left pointer further out
            l--; 
            // Move right pointer further out
            r++;
        }
        
        // Return the number of palindromes found from this center
        return cnt;
    }
}
```

### Valid Parentheses

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Valid Parentheses](https://leetcode.com/problems/valid-parentheses/)


Given a string `s` containing just the characters `'('`, `')'`, `'{'`, `'}'`, `'['` and `']'`, determine if the input string is valid.

An input string is valid if:

<ol>
	- Open brackets must be closed by the same type of brackets.

	- Open brackets must be closed in the correct order.

	- Every close bracket has a corresponding open bracket of the same type.

</ol>

 

<strong class="example">Example 1:</strong>

<div class="example-block">

**Input:** <span class="example-io">s = "()"</span>

**Output:** <span class="example-io">true</span>
</div>

<strong class="example">Example 2:</strong>

<div class="example-block">

**Input:** <span class="example-io">s = "()[]{}"</span>

**Output:** <span class="example-io">true</span>
</div>

<strong class="example">Example 3:</strong>

<div class="example-block">

**Input:** <span class="example-io">s = "(]"</span>

**Output:** <span class="example-io">false</span>
</div>

<strong class="example">Example 4:</strong>

<div class="example-block">

**Input:** <span class="example-io">s = "([])"</span>

**Output:** <span class="example-io">true</span>
</div>

<strong class="example">Example 5:</strong>

<div class="example-block">

**Input:** <span class="example-io">s = "([)]"</span>

**Output:** <span class="example-io">false</span>
</div>

 

**Constraints:**

	- `1 <= s.length <= 10<sup>4</sup>`

	- `s` consists of parentheses only `'()[]{}'`.

</details>

**Category:** ⭐ Tier 1 · Core
**Pattern:** Stack matching  **Time:** O(n)  **Space:** O(n)
**Approach:** Push opening brackets onto a stack. On a closing bracket, the stack top must be the matching opener; otherwise the string is invalid. A valid string leaves the stack empty at the end.


```java
import java.util.*;

class Solution {
    public boolean isValid(String s) {
        // Use a Deque as a stack to keep track of expected closing brackets
        Deque<Character> stack = new ArrayDeque<>();
        
        // Iterate through each character in the string
        for (char c : s.toCharArray()) {
            // If it's an opening parenthesis, push its corresponding closing bracket onto the stack
            if (c == '(') stack.push(')');
            // If it's an opening bracket, push its corresponding closing bracket
            else if (c == '[') stack.push(']');
            // If it's an opening brace, push its corresponding closing bracket
            else if (c == '{') stack.push('}');
            // If it's a closing bracket, check if the stack is empty or the top doesn't match
            else if (stack.isEmpty() || stack.pop() != c) return false;
        }
        
        // The string is valid if there are no unmatched brackets left in the stack
        return stack.isEmpty();
    }
}
```

### Decode String

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Decode String](https://leetcode.com/problems/decode-string/)


Given an encoded string, return its decoded string.

The encoding rule is: `k[encoded_string]`, where the `encoded_string` inside the square brackets is being repeated exactly `k` times. Note that `k` is guaranteed to be a positive integer.

You may assume that the input string is always valid; there are no extra white spaces, square brackets are well-formed, etc. Furthermore, you may assume that the original data does not contain any digits and that digits are only for those repeat numbers, `k`. For example, there will not be input like `3a` or `2[4]`.

The test cases are generated so that the length of the output will never exceed `10<sup>5</sup>`.

 

<strong class="example">Example 1:</strong>

```text

**Input:** s = "3[a]2[bc]"
**Output:** "aaabcbc"

```

<strong class="example">Example 2:</strong>

```text

**Input:** s = "3[a2[c]]"
**Output:** "accaccacc"

```

<strong class="example">Example 3:</strong>

```text

**Input:** s = "2[abc]3[cd]ef"
**Output:** "abcabccdcdcdef"

```

 

**Constraints:**

	- `1 <= s.length <= 30`

	- `s` consists of lowercase English letters, digits, and square brackets `'[]'`.

	- `s` is guaranteed to be **a valid** input.

	- All the integers in `s` are in the range `[1, 300]`.

</details>

**Category:** Tier 2 · Reinforce
**Pattern:** Two stacks (nested)  **Time:** O(n·maxK)  **Space:** O(n)
**Approach:** Parse left to right using one stack for repeat counts and one for the string built so far. On `[`, push the current number and accumulated string, then reset. On `]`, pop the count and previous string, and append the current segment repeated `count` times. Digits accumulate multi-digit numbers; letters append to the current segment.


```java
import java.util.*;

class Solution {
    public String decodeString(String s) {
        // Stack to store the repetition counts
        Deque<Integer> counts = new ArrayDeque<>();
        // Stack to store previously accumulated strings before new brackets
        Deque<StringBuilder> strs = new ArrayDeque<>();
        
        // StringBuilder to accumulate the current sequence of characters
        StringBuilder cur = new StringBuilder();
        // Variable to parse multi-digit repetition counts
        int num = 0;
        
        // Iterate through each character in the encoded string
        for (char c : s.toCharArray()) {
            if (Character.isDigit(c)) {
                // Accumulate the digit into the 'num' variable (handles multi-digit numbers)
                num = num * 10 + (c - '0');
            } else if (c == '[') {
                // When encountering '[', push the current count and string to their respective stacks
                counts.push(num);
                strs.push(cur);
                // Reset for the new sequence inside the brackets
                cur = new StringBuilder();
                num = 0;
            } else if (c == ']') {
                // When encountering ']', pop the repetition count for the current sequence
                int k = counts.pop();
                // Pop the string that came before the matching '['
                StringBuilder prev = strs.pop();
                // Append the current sequence 'k' times to the previous string
                for (int i = 0; i < k; i++) prev.append(cur);
                // Update 'cur' to the newly combined string
                cur = prev;
            } else {
                // It's a regular letter, so simply append it to the current sequence
                cur.append(c);
            }
        }
        
        // Return the fully decoded string
        return cur.toString();
    }
}
```

### Basic Calculator II

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Basic Calculator II](https://leetcode.com/problems/basic-calculator-ii/)


Given a string `s` which represents an expression, *evaluate this expression and return its value*. 

The integer division should truncate toward zero.

You may assume that the given expression is always valid. All intermediate results will be in the range of `[-2<sup>31</sup>, 2<sup>31</sup> - 1]`.

**Note:** You are not allowed to use any built-in function which evaluates strings as mathematical expressions, such as `eval()`.

 

<strong class="example">Example 1:</strong>

```text
**Input:** s = "3+2*2"
**Output:** 7

```

<strong class="example">Example 2:</strong>

```text
**Input:** s = " 3/2 "
**Output:** 1

```

<strong class="example">Example 3:</strong>

```text
**Input:** s = " 3+5 / 2 "
**Output:** 5

```

 

**Constraints:**

	- `1 <= s.length <= 3 * 10<sup>5</sup>`

	- `s` consists of integers and operators `('+', '-', '*', '/')` separated by some number of spaces.

	- `s` represents a valid expression.

	- All the integers in the expression are non-negative integers in the range `[0, 2<sup>31</sup> - 1]`.

	- The answer is **guaranteed** to fit in a **32-bit integer**.

</details>

**Category:** Tier 2 · Reinforce
**Pattern:** Stack of terms (precedence)  **Time:** O(n)  **Space:** O(n)
**Approach:** Handle `+ - * /` without parentheses by tracking the last operator. Accumulate each number, then on the next operator (or end of string) apply the pending operator: push for `+`, push negated for `-`, or pop-and-combine for `*` `/`. The final answer is the sum of the stack.


```java
import java.util.*;

class Solution {
    public int calculate(String s) {
        // Stack to store values waiting to be summed at the end
        Deque<Integer> stack = new ArrayDeque<>();
        // Variable to build multi-digit numbers
        int num = 0;
        // Default the previous operator to '+'
        char op = '+';
        
        // Iterate through each character of the expression
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            
            // Build the current number if the character is a digit
            if (Character.isDigit(c)) num = num * 10 + (c - '0');
            
            // If it's an operator or the last character in the string, evaluate based on the pending operator
            if ((!Character.isDigit(c) && c != ' ') || i == s.length() - 1) {
                // Apply the previous operator to the accumulated number
                if (op == '+') stack.push(num);           // Just push for addition
                else if (op == '-') stack.push(-num);       // Push negative for subtraction
                else if (op == '*') stack.push(stack.pop() * num); // Multiply immediately with the top of stack
                else if (op == '/') stack.push(stack.pop() / num); // Divide immediately with the top of stack
                
                // Update the pending operator to the current one
                op = c;
                // Reset the number accumulator
                num = 0;
            }
        }
        
        // Sum up all the evaluated terms left in the stack
        int res = 0;
        while (!stack.isEmpty()) res += stack.pop();
        
        return res;
    }
}
```

### Simplify Path

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Simplify Path](https://leetcode.com/problems/simplify-path/)


You are given an *absolute* path for a Unix-style file system, which always begins with a slash `'/'`. Your task is to transform this absolute path into its **simplified canonical path**.

The *rules* of a Unix-style file system are as follows:

	- A single period `'.'` represents the current directory.

	- A double period `'..'` represents the previous/parent directory.

	- Multiple consecutive slashes such as `'//'` and `'///'` are treated as a single slash `'/'`.

	- Any sequence of periods that does **not match** the rules above should be treated as a **valid directory or** **file ****name**. For example, `'...' `and `'....'` are valid directory or file names.

The simplified canonical path should follow these *rules*:

	- The path must start with a single slash `'/'`.

	- Directories within the path must be separated by exactly one slash `'/'`.

	- The path must not end with a slash `'/'`, unless it is the root directory.

	- The path must not have any single or double periods (`'.'` and `'..'`) used to denote current or parent directories.

Return the **simplified canonical path**.

 

<strong class="example">Example 1:</strong>

<div class="example-block">

**Input:** <span class="example-io">path = "/home/"</span>

**Output:** <span class="example-io">"/home"</span>

**Explanation:**

The trailing slash should be removed.
</div>

<strong class="example">Example 2:</strong>

<div class="example-block">

**Input:** <span class="example-io">path = "/home//foo/"</span>

**Output:** <span class="example-io">"/home/foo"</span>

**Explanation:**

Multiple consecutive slashes are replaced by a single one.
</div>

<strong class="example">Example 3:</strong>

<div class="example-block">

**Input:** <span class="example-io">path = "/home/user/Documents/../Pictures"</span>

**Output:** <span class="example-io">"/home/user/Pictures"</span>

**Explanation:**

A double period `".."` refers to the directory up a level (the parent directory).
</div>

<strong class="example">Example 4:</strong>

<div class="example-block">

**Input:** <span class="example-io">path = "/../"</span>

**Output:** <span class="example-io">"/"</span>

**Explanation:**

Going one level up from the root directory is not possible.
</div>

<strong class="example">Example 5:</strong>

<div class="example-block">

**Input:** <span class="example-io">path = "/.../a/../b/c/../d/./"</span>

**Output:** <span class="example-io">"/.../b/d"</span>

**Explanation:**

`"..."` is a valid name for a directory in this problem.
</div>

 

**Constraints:**

	- `1 <= path.length <= 3000`

	- `path` consists of English letters, digits, period `'.'`, slash `'/'` or `'_'`.

	- `path` is a valid absolute Unix path.

</details>

**Category:** Tier 3 · Reference
**Pattern:** Stack of path components  **Time:** O(n)  **Space:** O(n)
**Approach:** Split the Unix path on `/`. Ignore empty components and `.`; on `..` pop the last directory if present; otherwise push the directory name. Join the stack with `/` and prepend a leading slash for the canonical absolute path.


```java
import java.util.*;

class Solution {
    public String simplifyPath(String path) {
        // Stack to store the valid directory components
        Deque<String> stack = new ArrayDeque<>();
        
        // Split the path by the slash separator
        for (String part : path.split("/")) {
            // Ignore empty segments (caused by consecutive slashes) or current directory (.) references
            if (part.isEmpty() || part.equals(".")) continue;
            
            // If it's a parent directory reference (..), pop the last valid directory from the stack
            if (part.equals("..")) {
                if (!stack.isEmpty()) stack.pop();
            } else {
                // Otherwise, it's a normal directory name, so push it onto the stack
                stack.push(part);
            }
        }
        
        // Build the simplified path from the components in the stack
        StringBuilder sb = new StringBuilder();
        // Use a descending iterator to build from the oldest (root) to newest
        Iterator<String> it = stack.descendingIterator();
        
        // Prepend a slash before each component
        while (it.hasNext()) sb.append('/').append(it.next());
        
        // If the resulting path is empty, return just the root slash
        return sb.length() == 0 ? "/" : sb.toString();
    }
}
```

### Implement strStr / KMP

<!-- Problem Statement not automatically found -->

**Category:** ⭐ Tier 1 · Core
**Pattern:** Failure function (LPS array)  **Time:** O(n + m)  **Space:** O(m)
**Approach:** Build the longest-proper-prefix-that-is-also-suffix (LPS) array for the pattern, then scan the text without ever backing up the text pointer. On a mismatch, fall back the pattern pointer to `lps[j-1]` instead of restarting. The LPS build itself is a self-match of the pattern against its own prefix.


```java
class Solution {
    public int strStr(String haystack, String needle) {
        // An empty pattern is found at index 0 by definition
        if (needle.isEmpty()) return 0;
        
        // Precompute the LPS (Longest Proper Prefix which is also Suffix) array
        int[] lps = buildLps(needle);
        
        // i tracks haystack index, j tracks needle index
        int i = 0, j = 0;
        while (i < haystack.length()) {
            // If characters match, advance both pointers
            if (haystack.charAt(i) == needle.charAt(j)) {
                i++; j++;
                // If we've matched the whole needle, return the start index
                if (j == needle.length()) return i - j;
            } else if (j > 0) {
                // Mismatch after some matches: use LPS to fall back j without rewinding i
                j = lps[j - 1];
            } else {
                // Mismatch on the first character: advance i
                i++;
            }
        }
        // Needle was not found in the haystack
        return -1;
    }

    // Helper method to build the LPS array for the KMP algorithm
    private int[] buildLps(String p) {
        // The LPS array stores the length of the longest proper prefix that is also a suffix
        int[] lps = new int[p.length()];
        // len tracks the length of the current matching prefix; i is the current pattern index
        int len = 0, i = 1;
        
        // Loop over the pattern characters
        while (i < p.length()) {
            // If there's a match, increment length and store it at lps[i]
            if (p.charAt(i) == p.charAt(len)) {
                lps[i++] = ++len;
            } else if (len > 0) {
                // Mismatch: fallback the length to the previous LPS value
                len = lps[len - 1];
            } else {
                // No match and len is 0: lps[i] is 0
                lps[i++] = 0;
            }
        }
        return lps;
    }
}
```
**Alternative(s):** Rabin-Karp uses a rolling hash for average O(n+m) but has hash-collision worst cases; the naive O(n·m) double loop is fine for short inputs.

### String Compression

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [String Compression](https://leetcode.com/problems/string-compression/)


Given an array of characters `chars`, compress it using the following algorithm:

Begin with an empty string `s`. For each group of **consecutive repeating characters** in `chars`:

	- If the group's length is `1`, append the character to `s`.

	- Otherwise, append the character followed by the group's length.

The compressed string `s` **should not be returned separately**, but instead, be stored **in the input character array `chars`**. Note that group lengths that are `10` or longer will be split into multiple characters in `chars`.

After you are done **modifying the input array,** return *the new length of the array*.

You must write an algorithm that uses only constant extra space.

**Note: **The characters in the array beyond the returned length do not matter and should be ignored.

 

<strong class="example">Example 1:</strong>

```text

**Input:** chars = ["a","a","b","b","c","c","c"]
**Output:** 6
**Explanation:** The groups are `"aa"`, `"bb"`, and `"ccc"`. This compresses to `"a2b2c3"`.
After modifying the input array in-place, the first 6 characters of `chars` should be `["a","2","b","2","c","3"]`.

```

<strong class="example">Example 2:</strong>

```text

**Input:** chars = ["a"]
**Output:** 1
**Explanation:** The only group is `"a"`, which remains uncompressed since it is a single character.
After modifying the input array in-place, the first character of `chars` should be `["a"]`.

```

<strong class="example">Example 3:</strong>

```text

**Input:** chars = ["a","b","b","b","b","b","b","b","b","b","b","b","b"]
**Output:** 4
**Explanation:** The groups are `"a"` and `"bbbbbbbbbbbb"`. This compresses to `"ab12"`.
After modifying the input array in-place, the first 4 characters of `chars` should be `["a","b","1","2"]`.

```

 

**Constraints:**

	- `1 <= chars.length <= 2000`

	- `chars[i]` is a lowercase English letter, uppercase English letter, digit, or symbol.

</details>

**Category:** Tier 3 · Reference
**Pattern:** In-place two pointers  **Time:** O(n)  **Space:** O(1)
**Approach:** Use a read pointer to count consecutive runs and a write pointer to emit the character followed by the count digits (only when count > 1). Write in place into the same array and return the new logical length. Multi-digit counts are written digit by digit.


```java
class Solution {
    public int compress(char[] chars) {
        // Pointers for writing compressed data and reading original data
        int write = 0, read = 0;
        
        // Process the entire array
        while (read < chars.length) {
            // Identify the current character group
            char c = chars[read];
            // Track the length of the current run of identical characters
            int count = 0;
            
            // Advance read pointer while the character remains the same
            while (read < chars.length && chars[read] == c) {
                read++; 
                count++;
            }
            
            // Write the character to the array
            chars[write++] = c;
            
            // If the group has more than 1 character, write the count as well
            if (count > 1) {
                // Convert count to string and write each digit
                for (char digit : Integer.toString(count).toCharArray()) {
                    chars[write++] = digit;
                }
            }
        }
        
        // Return the new logical length of the compressed array
        return write;
    }
}
```

### Reverse Words in a String

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Reverse Words in a String](https://leetcode.com/problems/reverse-words-in-a-string/)


Given an input string `s`, reverse the order of the **words**.

A **word** is defined as a sequence of non-space characters. The **words** in `s` will be separated by at least one space.

Return *a string of the words in reverse order concatenated by a single space.*

**Note** that `s` may contain leading or trailing spaces or multiple spaces between two words. The returned string should only have a single space separating the words. Do not include any extra spaces.

 

<strong class="example">Example 1:</strong>

```text

**Input:** s = "the sky is blue"
**Output:** "blue is sky the"

```

<strong class="example">Example 2:</strong>

```text

**Input:** s = "  hello world  "
**Output:** "world hello"
**Explanation:** Your reversed string should not contain leading or trailing spaces.

```

<strong class="example">Example 3:</strong>

```text

**Input:** s = "a good   example"
**Output:** "example good a"
**Explanation:** You need to reduce multiple spaces between two words to a single space in the reversed string.

```

 

**Constraints:**

	- `1 <= s.length <= 10<sup>4</sup>`

	- `s` contains English letters (upper-case and lower-case), digits, and spaces `' '`.

	- There is **at least one** word in `s`.

 

<b data-stringify-type="bold">Follow-up: </b>If the string data type is mutable in your language, can you solve it <b data-stringify-type="bold">in-place</b> with <code data-stringify-type="code">O(1)</code> extra space?

</details>

**Category:** Tier 2 · Reinforce
**Pattern:** Split / trim / reverse  **Time:** O(n)  **Space:** O(n)
**Approach:** Trim outer whitespace, split on one-or-more spaces to drop internal gaps, reverse the resulting word list, and join with single spaces. This normalizes messy spacing in one pass of tokenization.


```java
class Solution {
    public String reverseWords(String s) {
        // Trim leading/trailing whitespace and split by one or more spaces
        String[] words = s.trim().split("\\s+");
        
        // StringBuilder to reconstruct the reversed string
        StringBuilder sb = new StringBuilder();
        
        // Iterate over the words in reverse order
        for (int i = words.length - 1; i >= 0; i--) {
            // Append the current word
            sb.append(words[i]);
            // Add a single space between words, but not after the last one
            if (i > 0) sb.append(' ');
        }
        
        // Return the final formatted string
        return sb.toString();
    }
}
```
**Alternative(s):** For O(1) extra space on a mutable char array: reverse the entire array, then reverse each word in place, then clean up spaces.

---

## HASHING

### Two Sum

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Two Sum](https://leetcode.com/problems/two-sum/)


You are given an array of integers `nums` and an integer `target`, return *indices of the two numbers such that they add up to `target`*.

You may assume that each input would have ***exactly* one solution**, and you may not use the *same* element twice.

You can return the answer in any order.

 

<strong class="example">Example 1:</strong>

```text

**Input:** nums = [2,7,11,15], target = 9
**Output:** [0,1]
**Explanation:** Because nums[0] + nums[1] == 9, we return [0, 1].

```

<strong class="example">Example 2:</strong>

```text

**Input:** nums = [3,2,4], target = 6
**Output:** [1,2]

```

<strong class="example">Example 3:</strong>

```text

**Input:** nums = [3,3], target = 6
**Output:** [0,1]

```

 

**Constraints:**

	- `2 <= nums.length <= 10<sup>4</sup>`

	- `-10<sup>9</sup> <= nums[i] <= 10<sup>9</sup>`

	- `-10<sup>9</sup> <= target <= 10<sup>9</sup>`

	- **Only one valid answer exists.**

 
**Follow-up: **Can you come up with an algorithm that is less than `O(n<sup>2</sup>)`<font face="monospace"> </font>time complexity?

</details>

**Category:** ⭐ Tier 1 · Core
**Pattern:** Complement hash map  **Time:** O(n)  **Space:** O(n)
**Approach:** For each number, check if its complement (`target - num`) has already been seen. Store each number's index in a map as you go; the first hit gives the answer pair in a single pass.


```java
import java.util.*;

class Solution {
    public int[] twoSum(int[] nums, int target) {
        // Map to store values we have seen so far and their indices
        Map<Integer, Integer> seen = new HashMap<>();
        
        // Iterate through the array once
        for (int i = 0; i < nums.length; i++) {
            // Calculate the complement needed to reach the target sum
            int need = target - nums[i];
            
            // If the complement is already in the map, we found our pair!
            if (seen.containsKey(need)) return new int[]{seen.get(need), i};
            
            // Otherwise, add the current number and its index to the map
            seen.put(nums[i], i);
        }
        
        // Fallback return (problem guarantees one valid answer, so this shouldn't be reached)
        return new int[]{-1, -1};
    }
}
```

### Contains Duplicate

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Contains Duplicate](https://leetcode.com/problems/contains-duplicate/)


Given an integer array `nums`, return `true` if any value appears **at least twice** in the array, and return `false` if every element is distinct.

 

<strong class="example">Example 1:</strong>

<div class="example-block">

**Input:** <span class="example-io">nums = [1,2,3,1]</span>

**Output:** <span class="example-io">true</span>

**Explanation:**

The element 1 occurs at the indices 0 and 3.
</div>

<strong class="example">Example 2:</strong>

<div class="example-block">

**Input:** <span class="example-io">nums = [1,2,3,4]</span>

**Output:** <span class="example-io">false</span>

**Explanation:**

All elements are distinct.
</div>

<strong class="example">Example 3:</strong>

<div class="example-block">

**Input:** <span class="example-io">nums = [1,1,1,3,3,4,3,2,4,2]</span>

**Output:** <span class="example-io">true</span>
</div>

 

**Constraints:**

	- `1 <= nums.length <= 10<sup>5</sup>`

	- `-10<sup>9</sup> <= nums[i] <= 10<sup>9</sup>`

</details>

**Category:** Tier 3 · Reference
**Pattern:** Set membership  **Time:** O(n)  **Space:** O(n)
**Approach:** Insert elements into a hash set; if an insertion fails (element already present) a duplicate exists. Early-return on the first collision.


```java
import java.util.*;

class Solution {
    public boolean containsDuplicate(int[] nums) {
        // Use a HashSet to track unique elements
        Set<Integer> seen = new HashSet<>();
        
        // Iterate through each number in the array
        for (int n : nums) {
            // Set.add() returns false if the element was already present
            if (!seen.add(n)) return true;
        }
        
        // If the loop finishes, all elements were unique
        return false;
    }
}
```

### Longest Consecutive Sequence

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Longest Consecutive Sequence](https://leetcode.com/problems/longest-consecutive-sequence/)


Given an unsorted array of integers `nums`, return *the length of the longest consecutive elements sequence.*

You must write an algorithm that runs in `O(n)` time.

 

<strong class="example">Example 1:</strong>

```text

**Input:** nums = [100,4,200,1,3,2]
**Output:** 4
**Explanation:** The longest consecutive elements sequence is `[1, 2, 3, 4]`. Therefore its length is 4.

```

<strong class="example">Example 2:</strong>

```text

**Input:** nums = [0,3,7,2,5,8,4,6,0,1]
**Output:** 9

```

<strong class="example">Example 3:</strong>

```text

**Input:** nums = [1,0,1,2]
**Output:** 3

```

 

**Constraints:**

	- `0 <= nums.length <= 10<sup>5</sup>`

	- `-10<sup>9</sup> <= nums[i] <= 10<sup>9</sup>`

</details>

**Category:** ⭐ Tier 1 · Core
**Pattern:** Hash set sequence-start scan  **Time:** O(n)  **Space:** O(n)
**Approach:** Put all numbers in a set. Only start counting a run from a number whose predecessor (`num-1`) is absent — that guarantees it's a sequence start. Walk upward counting consecutive members. Each number is visited at most twice, giving overall O(n).


```java
import java.util.*;

class Solution {
    public int longestConsecutive(int[] nums) {
        // Store all elements in a HashSet for O(1) lookups
        Set<Integer> set = new HashSet<>();
        for (int n : nums) set.add(n);
        
        // Variable to track the maximum sequence length found
        int longest = 0;
        
        // Iterate over the unique numbers in the set
        for (int n : set) {
            // Only start counting if 'n' is the beginning of a sequence (no n-1 exists)
            if (!set.contains(n - 1)) {
                int cur = n, length = 1;
                
                // Keep looking for the next consecutive number
                while (set.contains(cur + 1)) {
                    cur++; 
                    length++;
                }
                
                // Update the longest sequence length found so far
                longest = Math.max(longest, length);
            }
        }
        
        // Return the overall longest sequence length
        return longest;
    }
}
```

### Isomorphic Strings

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Isomorphic Strings](https://leetcode.com/problems/isomorphic-strings/)


Given two strings `s` and `t`, *determine if they are isomorphic*.

Two strings `s` and `t` are isomorphic if the characters in `s` can be replaced to get `t`.

All occurrences of a character must be replaced with another character while preserving the order of characters. No two characters may map to the same character, but a character may map to itself.

 

<strong class="example">Example 1:</strong>

<div class="example-block">

**Input:** <span class="example-io">s = "egg", t = "add"</span>

**Output:** <span class="example-io">true</span>

**Explanation:**

The strings `s` and `t` can be made identical by:

	- Mapping `'e'` to `'a'`.

	- Mapping `'g'` to `'d'`.

</div>

<strong class="example">Example 2:</strong>

<div class="example-block">

**Input:** <span class="example-io">s = "f11", t = "b23"</span>

**Output:** <span class="example-io">false</span>

**Explanation:**

The strings `s` and `t` can not be made identical as `'1'` needs to be mapped to both `'2'` and `'3'`.
</div>

<strong class="example">Example 3:</strong>

<div class="example-block">

**Input:** <span class="example-io">s = "paper", t = "title"</span>

**Output:** <span class="example-io">true</span>
</div>

 

**Constraints:**

	- `1 <= s.length <= 5 * 10<sup>4</sup>`

	- `t.length == s.length`

	- `s` and `t` consist of any valid ascii character.

</details>

**Category:** Tier 2 · Reinforce
**Pattern:** Bidirectional mapping  **Time:** O(n)  **Space:** O(1)
**Approach:** A character in `s` must map to exactly one character in `t` and vice versa. Track both mappings; on any conflict with a previously recorded mapping, reject. Two arrays indexed by char code make the checks O(1).


```java
class Solution {
    public boolean isIsomorphic(String s, String t) {
        // Arrays to map characters from s to t, and t to s
        int[] mapST = new int[256], mapTS = new int[256];
        
        // Initialize maps with -1 (since 0 is a valid character code)
        java.util.Arrays.fill(mapST, -1);
        java.util.Arrays.fill(mapTS, -1);
        
        // Iterate through both strings simultaneously
        for (int i = 0; i < s.length(); i++) {
            char a = s.charAt(i), b = t.charAt(i);
            
            // If neither character has been mapped yet, establish a two-way mapping
            if (mapST[a] == -1 && mapTS[b] == -1) {
                mapST[a] = b;
                mapTS[b] = a;
            } 
            // If a mapping exists, but it contradicts the current characters, strings aren't isomorphic
            else if (mapST[a] != b || mapTS[b] != a) {
                return false;
            }
        }
        
        // All character mappings are consistent
        return true;
    }
}
```

### Word Pattern

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Word Pattern](https://leetcode.com/problems/word-pattern/)


Given a `pattern` and a string `s`, find if `s` follows the same pattern.

Here **follow** means a full match, such that there is a bijection between a letter in `pattern` and a **non-empty** word in `s`. Specifically:

	- Each letter in `pattern` maps to **exactly** one unique word in `s`.

	- Each unique word in `s` maps to **exactly** one letter in `pattern`.

	- No two letters map to the same word, and no two words map to the same letter.

 

<strong class="example">Example 1:</strong>

<div class="example-block">

**Input:** <span class="example-io">pattern = "abba", s = "dog cat cat dog"</span>

**Output:** <span class="example-io">true</span>

**Explanation:**

The bijection can be established as:

	- `'a'` maps to `"dog"`.

	- `'b'` maps to `"cat"`.

</div>

<strong class="example">Example 2:</strong>

<div class="example-block">

**Input:** <span class="example-io">pattern = "abba", s = "dog cat cat fish"</span>

**Output:** <span class="example-io">false</span>
</div>

<strong class="example">Example 3:</strong>

<div class="example-block">

**Input:** <span class="example-io">pattern = "aaaa", s = "dog cat cat dog"</span>

**Output:** <span class="example-io">false</span>
</div>

 

**Constraints:**

	- `1 <= pattern.length <= 300`

	- `pattern` contains only lower-case English letters.

	- `1 <= s.length <= 3000`

	- `s` contains only lowercase English letters and spaces `' '`.

	- `s` **does not contain** any leading or trailing spaces.

	- All the words in `s` are separated by a **single space**.

</details>

**Category:** Tier 3 · Reference
**Pattern:** Bidirectional mapping  **Time:** O(n)  **Space:** O(n)
**Approach:** Same bijection idea as Isomorphic Strings but between pattern characters and whitespace-split words. Maintain char→word and word→char maps; any inconsistency or word-count mismatch fails. Both directions are required to reject cases like `"ab"` with words `["dog","dog"]`.


```java
import java.util.*;

class Solution {
    public boolean wordPattern(String pattern, String s) {
        // Split the input string into individual words
        String[] words = s.split(" ");
        // If the number of characters and words don't match, bijection is impossible
        if (pattern.length() != words.length) return false;
        
        // Maps to track character-to-word and word-to-character relationships
        Map<Character, String> c2w = new HashMap<>();
        Map<String, Character> w2c = new HashMap<>();
        
        // Iterate over pattern characters and string words
        for (int i = 0; i < words.length; i++) {
            char c = pattern.charAt(i);
            String w = words[i];
            
            // Check for contradiction in char-to-word mapping
            if (c2w.containsKey(c) && !c2w.get(c).equals(w)) return false;
            // Check for contradiction in word-to-char mapping
            if (w2c.containsKey(w) && w2c.get(w) != c) return false;
            
            // Establish the two-way mapping
            c2w.put(c, w);
            w2c.put(w, c);
        }
        
        // All mappings are consistent
        return true;
    }
}
```

---

## BIT MANIPULATION

### Bit Tricks Reference

<!-- Problem Statement not automatically found -->

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
        // Variable to hold the cumulative XOR sum
        int x = 0;
        
        // Iterate through all numbers in the array
        for (int n : nums) {
            // XORing a number with itself cancels it out (a ^ a = 0)
            // XORing with 0 keeps the number (a ^ 0 = a)
            x ^= n;
        }
        
        // The numbers that appear twice cancel out, leaving only the single number
        return x;
    }
}
```

### Single Number II

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Single Number II](https://leetcode.com/problems/single-number-ii/)


Given an integer array `nums` where every element appears **three times** except for one, which appears **exactly once**. *Find the single element and return it*.

You must implement a solution with a linear runtime complexity and use only constant extra space.

 

<strong class="example">Example 1:</strong>

```text
**Input:** nums = [2,2,3,2]
**Output:** 3

```

<strong class="example">Example 2:</strong>

```text
**Input:** nums = [0,1,0,1,0,1,99]
**Output:** 99

```

 

**Constraints:**

	- `1 <= nums.length <= 3 * 10<sup>4</sup>`

	- `-2<sup>31</sup> <= nums[i] <= 2<sup>31</sup> - 1`

	- Each element in `nums` appears exactly **three times** except for one element which appears **once**.

</details>

**Category:** Tier 3 · Reference
**Pattern:** Bitwise state machine  **Time:** O(n)  **Space:** O(1)
**Approach:** Every element appears three times except one. Track two accumulators `ones` and `twos` representing bits seen once and twice (mod 3). Each bit cycles through 0→1→2→0 as duplicates arrive, so after processing, `ones` holds the unique number.


```java
class Solution {
    public int singleNumber(int[] nums) {
        // Variables to represent bits that appeared exactly once or twice
        int ones = 0, twos = 0;
        
        // Iterate through each number
        for (int n : nums) {
            // Update 'ones': Add bits from 'n' that are not in 'twos', remove bits that are already in 'ones'
            ones = (ones ^ n) & ~twos;
            
            // Update 'twos': Add bits from 'n' that are not in 'ones', remove bits that are already in 'twos'
            // (Note: 'ones' has already been updated, so bits that appeared a 3rd time were just removed from 'ones')
            twos = (twos ^ n) & ~ones;
        }
        
        // Return 'ones', which holds the bits of the element that appeared exactly once
        return ones;
    }
}
```
**Alternative(s):** Sum each of the 32 bit positions across all numbers; `sum % 3` reconstructs the unique number bit by bit. Clearer but O(32n).

### Single Number III

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Single Number III](https://leetcode.com/problems/single-number-iii/)


Given an integer array `nums`, in which exactly two elements appear only once and all the other elements appear exactly twice. Find the two elements that appear only once. You can return the answer in **any order**.

You must write an algorithm that runs in linear runtime complexity and uses only constant extra space.

 

<strong class="example">Example 1:</strong>

```text

**Input:** nums = [1,2,1,3,2,5]
**Output:** [3,5]
**Explanation: ** [5, 3] is also a valid answer.

```

<strong class="example">Example 2:</strong>

```text

**Input:** nums = [-1,0]
**Output:** [-1,0]

```

<strong class="example">Example 3:</strong>

```text

**Input:** nums = [0,1]
**Output:** [1,0]

```

 

**Constraints:**

	- `2 <= nums.length <= 3 * 10<sup>4</sup>`

	- `-2<sup>31</sup> <= nums[i] <= 2<sup>31</sup> - 1`

	- Each integer in `nums` will appear twice, only two integers will appear once.

</details>

**Category:** Tier 3 · Reference
**Pattern:** XOR + lowest-set-bit partition  **Time:** O(n)  **Space:** O(1)
**Approach:** Two elements appear once; the rest twice. XOR all numbers to get `a ^ b`. Any set bit in that result differs between `a` and `b`; isolate the lowest set bit (`xor & -xor`) and use it to partition numbers into two groups, XORing each group separately to recover `a` and `b`.


```java
class Solution {
    public int[] singleNumber(int[] nums) {
        // First, XOR all elements. The result is the XOR of the two unique numbers (a ^ b)
        int xor = 0;
        for (int n : nums) xor ^= n;
        
        // Isolate the lowest set bit in the XOR result
        // This bit is guaranteed to be different between the two unique numbers
        int diff = xor & -xor;
        
        // Variable to accumulate one of the unique numbers
        int a = 0;
        
        // Partition the array into two groups based on the distinguishing bit
        for (int n : nums) {
            // If the number has the distinguishing bit set, XOR it into 'a'
            if ((n & diff) != 0) a ^= n;
        }
        
        // The first unique number is 'a', the second is 'xor ^ a'
        return new int[]{a, xor ^ a};
    }
}
```

### Number of 1 Bits

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Number of 1 Bits](https://leetcode.com/problems/number-of-1-bits/)


Given a positive integer `n`, write a function that returns the number of <span data-keyword="set-bit">set bits</span> in its binary representation (also known as the <a href="http://en.wikipedia.org/wiki/Hamming_weight" target="_blank">Hamming weight</a>).

 

<strong class="example">Example 1:</strong>

<div class="example-block">

**Input:** <span class="example-io">n = 11</span>

**Output:** <span class="example-io">3</span>

**Explanation:**

The input binary string **1011** has a total of three set bits.
</div>

<strong class="example">Example 2:</strong>

<div class="example-block">

**Input:** <span class="example-io">n = 128</span>

**Output:** <span class="example-io">1</span>

**Explanation:**

The input binary string **10000000** has a total of one set bit.
</div>

<strong class="example">Example 3:</strong>

<div class="example-block">

**Input:** <span class="example-io">n = 2147483645</span>

**Output:** <span class="example-io">30</span>

**Explanation:**

The input binary string **1111111111111111111111111111101** has a total of thirty set bits.
</div>

 

**Constraints:**

	- `1 <= n <= 2<sup>31</sup> - 1`

 
**Follow up:** If this function is called many times, how would you optimize it?

</details>

**Category:** ⭐ Tier 1 · Core
**Pattern:** Clear-lowest-set-bit loop  **Time:** O(#bits set)  **Space:** O(1)
**Approach:** Repeatedly apply `n & (n - 1)`, which clears the lowest set bit each iteration. The number of iterations equals the population count. Use `>>>`/unsigned handling implicitly since the loop only touches set bits.


```java
class Solution {
    public int hammingWeight(int n) {
        // Variable to count the number of set bits (1s)
        int count = 0;
        
        // Loop until all set bits are cleared
        while (n != 0) {
            // n & (n - 1) always drops the lowest set bit from n
            n &= (n - 1);
            // Increment count for the cleared bit
            count++;
        }
        
        // Return the total number of set bits found
        return count;
    }
}
```

### Counting Bits

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Counting Bits](https://leetcode.com/problems/counting-bits/)


Given an integer `n`, return *an array *`ans`* of length *`n + 1`* such that for each *`i`* *(`0 <= i <= n`)*, *`ans[i]`* is the **number of ***`1`***'s** in the binary representation of *`i`.
Do not solve it with built-in functions (i.e., like `__builtin_popcount` in C++).

 

<strong class="example">Example 1:</strong>

```text

**Input:** n = 2
**Output:** [0,1,1]
**Explanation:**
0 --> 0
1 --> 1
2 --> 10

```

<strong class="example">Example 2:</strong>

```text

**Input:** n = 5
**Output:** [0,1,1,2,1,2]
**Explanation:**
0 --> 0
1 --> 1
2 --> 10
3 --> 11
4 --> 100
5 --> 101

```

 

**Constraints:**

	- `0 <= n <= 10<sup>5</sup>`

 

**Follow up:**

	- It is very easy to come up with a solution with a runtime of `O(n log n)`. Can you do it in linear time `O(n)` and possibly in a single pass?

</details>

**Category:** Tier 2 · Reinforce
**Pattern:** DP on bits  **Time:** O(n)  **Space:** O(n)
**Approach:** `bits[i] = bits[i >> 1] + (i & 1)`: dropping the lowest bit of `i` gives an already-computed smaller value, and the removed bit adds 0 or 1. This builds the full 0..n table in linear time.


```java
class Solution {
    public int[] countBits(int n) {
        // Array to store the number of set bits for each number from 0 to n
        int[] bits = new int[n + 1];
        
        // Iterate from 1 to n (bits[0] is already 0 by default)
        for (int i = 1; i <= n; i++) {
            // The number of bits in 'i' is the number of bits in 'i / 2' (which is i >> 1)
            // plus 1 if 'i' is odd (which is i & 1)
            bits[i] = bits[i >> 1] + (i & 1);
        }
        
        // Return the populated array
        return bits;
    }
}
```

### Reverse Bits

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Reverse Bits](https://leetcode.com/problems/reverse-bits/)


Reverse bits of a given 32 bits signed integer.

 

<strong class="example">Example 1:</strong>

<div class="example-block">

**Input:** <span class="example-io">n = 43261596</span>

**Output:** <span class="example-io">964176192</span>

**Explanation:**

<table>
	<tbody>
		<tr>
			<th>Integer</th>
			<th>Binary</th>
		</tr>
		<tr>
			<td>43261596</td>
			<td>00000010100101000001111010011100</td>
		</tr>
		<tr>
			<td>964176192</td>
			<td>00111001011110000010100101000000</td>
		</tr>
	</tbody>
</table>
</div>

<strong class="example">Example 2:</strong>

<div class="example-block">

**Input:** <span class="example-io">n = 2147483644</span>

**Output:** <span class="example-io">1073741822</span>

**Explanation:**

<table>
	<tbody>
		<tr>
			<th>Integer</th>
			<th>Binary</th>
		</tr>
		<tr>
			<td>2147483644</td>
			<td>01111111111111111111111111111100</td>
		</tr>
		<tr>
			<td>1073741822</td>
			<td>00111111111111111111111111111110</td>
		</tr>
	</tbody>
</table>
</div>

 

**Constraints:**

	- `0 <= n <= 2<sup>31</sup> - 2`

	- `n` is even.

 

**Follow up:** If this function is called many times, how would you optimize it?

</details>

**Category:** Tier 3 · Reference
**Pattern:** Bit-by-bit shift and OR  **Time:** O(32)  **Space:** O(1)
**Approach:** Shift the result left, take the lowest bit of the input, OR it into the result, then shift the input right. After 32 iterations the bit order is fully reversed. Use `>>>` for the unsigned input shift.


```java
public class Solution {
    public int reverseBits(int n) {
        // Variable to accumulate the reversed bits
        int result = 0;
        
        // Process exactly 32 bits since it's a 32-bit integer
        for (int i = 0; i < 32; i++) {
            // Shift the result to the left to make room for the next bit,
            // and OR it with the lowest bit of 'n' (n & 1)
            result = (result << 1) | (n & 1);
            
            // Logical right shift 'n' to process the next bit in the next iteration.
            // >>> is used to fill the leftmost bit with 0 regardless of the sign
            n >>>= 1;
        }
        
        // Return the fully reversed 32-bit integer
        return result;
    }
}
```

### Power of Two

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Power of Two](https://leetcode.com/problems/power-of-two/)


Given an integer `n`, return *`true` if it is a power of two. Otherwise, return `false`*.

An integer `n` is a power of two, if there exists an integer `x` such that `n == 2<sup>x</sup>`.

 

<strong class="example">Example 1:</strong>

```text

**Input:** n = 1
**Output:** true
**Explanation: **2<sup>0</sup> = 1

```

<strong class="example">Example 2:</strong>

```text

**Input:** n = 16
**Output:** true
**Explanation: **2<sup>4</sup> = 16

```

<strong class="example">Example 3:</strong>

```text

**Input:** n = 3
**Output:** false

```

 

**Constraints:**

	- `-2<sup>31</sup> <= n <= 2<sup>31</sup> - 1`

 
**Follow up:** Could you solve it without loops/recursion?

</details>

**Category:** Tier 3 · Reference
**Pattern:** Clear-lowest-bit trick  **Time:** O(1)  **Space:** O(1)
**Approach:** A positive power of two has exactly one set bit, so `n & (n - 1)` is zero. Guard against non-positive inputs first.


```java
class Solution {
    public boolean isPowerOfTwo(int n) {
        // A power of two must be strictly positive (> 0).
        // It must also have exactly one bit set in its binary representation.
        // If n has only one bit set, n & (n - 1) clears that bit and results in 0.
        return n > 0 && (n & (n - 1)) == 0;
    }
}
```

### Sum of Two Integers (without +)

<!-- Problem Statement not automatically found -->

**Category:** Tier 2 · Reinforce
**Pattern:** XOR + carry loop  **Time:** O(1)  **Space:** O(1)
**Approach:** XOR gives the sum without carries; AND-then-left-shift gives the carry bits. Repeat until there is no carry left. This is how a full adder works, expressed iteratively.


```java
class Solution {
    public int getSum(int a, int b) {
        // Iterate until there is no carry left
        while (b != 0) {
            // The carry occurs where both 'a' and 'b' have bits set to 1.
            // We shift it left by 1 because a carry affects the next higher bit position.
            int carry = (a & b) << 1;
            
            // XOR acts as a sum without considering the carry bits.
            a = a ^ b;
            
            // The carry becomes the new 'b', which will be added to 'a' in the next iteration.
            b = carry;
        }
        
        // When 'b' (carry) becomes 0, 'a' contains the final sum
        return a;
    }
}
```

### Subsets via Bitmask

<!-- Problem Statement not automatically found -->

**Category:** Tier 3 · Reference
**Pattern:** Enumerate 2^n masks  **Time:** O(n·2^n)  **Space:** O(n·2^n)
**Approach:** Each subset corresponds to an n-bit mask where bit `j` set means element `j` is included. Iterate all masks from 0 to 2^n − 1 and build the subset by testing each bit. Elegant when n is small (≤ ~20).


```java
import java.util.*;

class Solution {
    public List<List<Integer>> subsets(int[] nums) {
        int n = nums.length;
        // List to hold all the subsets
        List<List<Integer>> res = new ArrayList<>();
        
        // Loop from 0 to 2^n - 1. Each number represents a bitmask where each bit 
        // corresponds to an element in 'nums'.
        for (int mask = 0; mask < (1 << n); mask++) {
            // List to hold the current subset
            List<Integer> subset = new ArrayList<>();
            
            // Check each bit of the current mask
            for (int j = 0; j < n; j++) {
                // If the j-th bit is set (1), include the j-th element in the subset
                if ((mask & (1 << j)) != 0) {
                    subset.add(nums[j]);
                }
            }
            
            // Add the constructed subset to the result list
            res.add(subset);
        }
        
        // Return the full power set
        return res;
    }
}
```
**Alternative(s):** Backtracking recursion produces the same power set and generalizes better to pruning/constraints.

---

## MATH / NUMBER THEORY

### Pow(x, n) — Fast Exponentiation

<!-- Problem Statement not automatically found -->

**Category:** ⭐ Tier 1 · Core
**Pattern:** Binary exponentiation  **Time:** O(log n)  **Space:** O(1)
**Approach:** Square the base while halving the exponent; multiply the result whenever the current exponent bit is set. Handle negative exponents by inverting the base and using a `long` for the exponent to avoid overflow when negating `Integer.MIN_VALUE`.


```java
class Solution {
    public double myPow(double x, int n) {
        // Use a long to avoid overflow when taking the absolute value of Integer.MIN_VALUE
        long exp = n;
        
        // If the exponent is negative, invert the base and make the exponent positive
        if (exp < 0) {
            x = 1 / x;
            exp = -exp;
        }
        
        // Initialize the result to 1.0 (multiplicative identity)
        double result = 1.0;
        
        // Binary exponentiation loop
        while (exp > 0) {
            // If the current lowest bit of the exponent is 1, multiply the result by the current base
            if ((exp & 1) == 1) result *= x;
            
            // Square the base for the next bit position
            x *= x;
            
            // Right-shift the exponent by 1 (divide by 2) to process the next bit
            exp >>= 1;
        }
        
        // Return the final computed power
        return result;
    }
}
```

### Sqrt(x) — Binary Search

<!-- Problem Statement not automatically found -->

**Category:** Tier 2 · Reinforce
**Pattern:** Binary search on answer  **Time:** O(log x)  **Space:** O(1)
**Approach:** Search for the largest integer `m` with `m*m <= x`. Compare using `m <= x / m` to sidestep multiplication overflow. Narrow the range until it collapses on the floor of the square root.


```java
class Solution {
    public int mySqrt(int x) {
        // Base cases: the square root of 0 is 0, and 1 is 1
        if (x < 2) return x;
        
        // Initialize the search boundaries and the answer variable
        int lo = 1, hi = x, ans = 0;
        
        // Binary search loop
        while (lo <= hi) {
            // Find the middle point safely to avoid integer overflow
            int mid = lo + (hi - lo) / 2;
            
            // Check if mid squared is less than or equal to x.
            // Using division (mid <= x / mid) prevents overflow that mid * mid could cause.
            if (mid <= x / mid) {
                // mid is a valid candidate for the floor of the square root
                ans = mid;
                // Move the lower bound up to search for a potentially larger valid candidate
                lo = mid + 1;
            } else {
                // mid squared is strictly greater than x, so search the lower half
                hi = mid - 1;
            }
        }
        
        // Return the largest integer whose square is less than or equal to x
        return ans;
    }
}
```

### Happy Number

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Happy Number](https://leetcode.com/problems/happy-number/)


Write an algorithm to determine if a number `n` is happy.

A **happy number** is a number defined by the following process:

	- Starting with any positive integer, replace the number by the sum of the squares of its digits.

	- Repeat the process until the number equals 1 (where it will stay), or it **loops endlessly in a cycle** which does not include 1.

	- Those numbers for which this process **ends in 1** are happy.

Return `true` *if* `n` *is a happy number, and* `false` *if not*.

 

<strong class="example">Example 1:</strong>

```text

**Input:** n = 19
**Output:** true
**Explanation:**
1<sup>2</sup> + 9<sup>2</sup> = 82
8<sup>2</sup> + 2<sup>2</sup> = 68
6<sup>2</sup> + 8<sup>2</sup> = 100
1<sup>2</sup> + 0<sup>2</sup> + 0<sup>2</sup> = 1

```

<strong class="example">Example 2:</strong>

```text

**Input:** n = 2
**Output:** false

```

 

**Constraints:**

	- `1 <= n <= 2<sup>31</sup> - 1`

</details>

**Category:** Tier 3 · Reference
**Pattern:** Cycle detection (Floyd)  **Time:** O(log n)  **Space:** O(1)
**Approach:** Repeatedly replace the number with the sum of the squares of its digits. A happy number reaches 1; an unhappy one enters a cycle. Use fast/slow pointers to detect the loop without extra memory.


```java
class Solution {
    public boolean isHappy(int n) {
        // Use Floyd's Cycle-Finding Algorithm (Tortoise and Hare)
        int slow = n, fast = n;
        
        do {
            // Move slow pointer by one step
            slow = square(slow);
            // Move fast pointer by two steps
            fast = square(square(fast));
        } while (slow != fast); // Loop until they meet
        
        // If they meet at 1, it's a happy number; otherwise, it's stuck in a cycle
        return slow == 1;
    }

    // Helper method to calculate the sum of the squares of the digits
    private int square(int n) {
        int sum = 0;
        // Process each digit
        while (n > 0) {
            // Extract the last digit
            int d = n % 10;
            // Add its square to the sum
            sum += d * d;
            // Remove the last digit from n
            n /= 10;
        }
        // Return the computed sum
        return sum;
    }
}
```
**Alternative(s):** A `HashSet` of seen values detects the cycle too, at O(log n) extra space.

### Excel Sheet Column Number

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Excel Sheet Column Number](https://leetcode.com/problems/excel-sheet-column-number/)


Given a string `columnTitle` that represents the column title as appears in an Excel sheet, return *its corresponding column number*.

For example:

```text

A -> 1
B -> 2
C -> 3
...
Z -> 26
AA -> 27
AB -> 28 
...

```

 

<strong class="example">Example 1:</strong>

```text

**Input:** columnTitle = "A"
**Output:** 1

```

<strong class="example">Example 2:</strong>

```text

**Input:** columnTitle = "AB"
**Output:** 28

```

<strong class="example">Example 3:</strong>

```text

**Input:** columnTitle = "ZY"
**Output:** 701

```

 

**Constraints:**

	- `1 <= columnTitle.length <= 7`

	- `columnTitle` consists only of uppercase English letters.

	- `columnTitle` is in the range `["A", "FXSHRXW"]`.

</details>

**Category:** Tier 3 · Reference
**Pattern:** Base-26 parse  **Time:** O(n)  **Space:** O(1)
**Approach:** Treat the title as a bijective base-26 number where A=1..Z=26. Fold left to right: `result = result * 26 + (char - 'A' + 1)`.


```java
class Solution {
    public int titleToNumber(String columnTitle) {
        // Variable to hold the final computed column number
        int result = 0;
        
        // Iterate over each character in the string from left to right
        for (char c : columnTitle.toCharArray()) {
            // Multiply the current result by 26 (shifting left in base-26)
            // Then add the value of the current character ('A' = 1, 'B' = 2, ..., 'Z' = 26)
            result = result * 26 + (c - 'A' + 1);
        }
        
        // Return the integer value of the column title
        return result;
    }
}
```

### Excel Sheet Column Title

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Excel Sheet Column Title](https://leetcode.com/problems/excel-sheet-column-title/)


Given an integer `columnNumber`, return *its corresponding column title as it appears in an Excel sheet*.

For example:

```text

A -> 1
B -> 2
C -> 3
...
Z -> 26
AA -> 27
AB -> 28 
...

```

 

<strong class="example">Example 1:</strong>

```text

**Input:** columnNumber = 1
**Output:** "A"

```

<strong class="example">Example 2:</strong>

```text

**Input:** columnNumber = 28
**Output:** "AB"

```

<strong class="example">Example 3:</strong>

```text

**Input:** columnNumber = 701
**Output:** "ZY"

```

 

**Constraints:**

	- `1 <= columnNumber <= 2<sup>31</sup> - 1`

</details>

**Category:** Tier 3 · Reference
**Pattern:** Base-26 (bijective) build  **Time:** O(log n)  **Space:** O(n)
**Approach:** Convert a number to a bijective base-26 title. Because there is no zero digit, decrement by 1 before each `% 26` and `/ 26` step, then prepend the mapped letter. Build the string from least to most significant.


```java
class Solution {
    public String convertToTitle(int columnNumber) {
        // StringBuilder to accumulate the column title characters
        StringBuilder sb = new StringBuilder();
        
        // Loop until the number is completely converted
        while (columnNumber > 0) {
            // Decrement by 1 to make it 0-indexed (A=0, B=1, ..., Z=25)
            columnNumber--;
            
            // Calculate the current character and append it to the StringBuilder
            sb.append((char) ('A' + columnNumber % 26));
            
            // Move to the next significant "digit" in base-26
            columnNumber /= 26;
        }
        
        // Since we generated digits from least to most significant, we must reverse the result
        return sb.reverse().toString();
    }
}
```

### Roman to Integer

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Roman to Integer](https://leetcode.com/problems/roman-to-integer/)


Roman numerals are represented by seven different symbols: `I`, `V`, `X`, `L`, `C`, `D` and `M`.

```text

**Symbol**       **Value**
I             1
V             5
X             10
L             50
C             100
D             500
M             1000
```

For example, `2` is written as `II` in Roman numeral, just two ones added together. `12` is written as `XII`, which is simply `X + II`. The number `27` is written as `XXVII`, which is `XX + V + II`.

Roman numerals are usually written largest to smallest from left to right. However, the numeral for four is not `IIII`. Instead, the number four is written as `IV`. Because the one is before the five we subtract it making four. The same principle applies to the number nine, which is written as `IX`. There are six instances where subtraction is used:

	- `I` can be placed before `V` (5) and `X` (10) to make 4 and 9. 

	- `X` can be placed before `L` (50) and `C` (100) to make 40 and 90. 

	- `C` can be placed before `D` (500) and `M` (1000) to make 400 and 900.

Given a roman numeral, convert it to an integer.

 

<strong class="example">Example 1:</strong>

```text

**Input:** s = "III"
**Output:** 3
**Explanation:** III = 3.

```

<strong class="example">Example 2:</strong>

```text

**Input:** s = "LVIII"
**Output:** 58
**Explanation:** L = 50, V= 5, III = 3.

```

<strong class="example">Example 3:</strong>

```text

**Input:** s = "MCMXCIV"
**Output:** 1994
**Explanation:** M = 1000, CM = 900, XC = 90 and IV = 4.

```

 

**Constraints:**

	- `1 <= s.length <= 15`

	- `s` contains only the characters `('I', 'V', 'X', 'L', 'C', 'D', 'M')`.

	- It is **guaranteed** that `s` is a valid roman numeral in the range `[1, 3999]`.

</details>

**Category:** Tier 2 · Reinforce
**Pattern:** Subtractive scan  **Time:** O(n)  **Space:** O(1)
**Approach:** Map each numeral to its value. Scan left to right; if a symbol's value is less than the next symbol's value, subtract it (e.g. IV, IX), otherwise add it. This handles the six subtractive combinations naturally.


```java
class Solution {
    public int romanToInt(String s) {
        // Array to quickly look up Roman numeral values using their ASCII codes
        int[] val = new int[128];
        // Pre-fill the array with the standard Roman numeral values
        val['I'] = 1; val['V'] = 5; val['X'] = 10; val['L'] = 50;
        val['C'] = 100; val['D'] = 500; val['M'] = 1000;
        
        // Variable to hold the total accumulated value
        int total = 0;
        
        // Iterate through each character of the Roman numeral string
        for (int i = 0; i < s.length(); i++) {
            // Get the integer value of the current symbol
            int cur = val[s.charAt(i)];
            
            // If we are not at the last character and the current symbol is less than the next,
            // it's a subtractive combination (e.g., IV or IX), so we subtract it from the total.
            if (i + 1 < s.length() && cur < val[s.charAt(i + 1)]) {
                total -= cur;
            } else {
                // Otherwise, it's an additive combination, so we add it to the total.
                total += cur;
            }
        }
        
        // Return the final integer representation
        return total;
    }
}
```

### Integer to Roman

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Integer to Roman](https://leetcode.com/problems/integer-to-roman/)


Seven different symbols represent Roman numerals with the following values:

<table>
	<thead>
		<tr>
			<th>Symbol</th>
			<th>Value</th>
		</tr>
	</thead>
	<tbody>
		<tr>
			<td>I</td>
			<td>1</td>
		</tr>
		<tr>
			<td>V</td>
			<td>5</td>
		</tr>
		<tr>
			<td>X</td>
			<td>10</td>
		</tr>
		<tr>
			<td>L</td>
			<td>50</td>
		</tr>
		<tr>
			<td>C</td>
			<td>100</td>
		</tr>
		<tr>
			<td>D</td>
			<td>500</td>
		</tr>
		<tr>
			<td>M</td>
			<td>1000</td>
		</tr>
	</tbody>
</table>

Roman numerals are formed by appending the conversions of decimal place values from highest to lowest. Converting a decimal place value into a Roman numeral has the following rules:

	- If the value does not start with 4 or 9, select the symbol of the maximal value that can be subtracted from the input, append that symbol to the result, subtract its value, and convert the remainder to a Roman numeral.

	- If the value starts with 4 or 9 use the **subtractive form** representing one symbol subtracted from the following symbol, for example, 4 is 1 (`I`) less than 5 (`V`): `IV` and 9 is 1 (`I`) less than 10 (`X`): `IX`. Only the following subtractive forms are used: 4 (`IV`), 9 (`IX`), 40 (`XL`), 90 (`XC`), 400 (`CD`) and 900 (`CM`).

	- Only powers of 10 (`I`, `X`, `C`, `M`) can be appended consecutively at most 3 times to represent multiples of 10. You cannot append 5 (`V`), 50 (`L`), or 500 (`D`) multiple times. If you need to append a symbol 4 times use the **subtractive form**.

Given an integer, convert it to a Roman numeral.

 

<strong class="example">Example 1:</strong>

<div class="example-block">

**Input:** <span class="example-io">num = 3749</span>

**Output:** <span class="example-io">"MMMDCCXLIX"</span>

**Explanation:**

```text

3000 = MMM as 1000 (M) + 1000 (M) + 1000 (M)
 700 = DCC as 500 (D) + 100 (C) + 100 (C)
  40 = XL as 10 (X) less of 50 (L)
   9 = IX as 1 (I) less of 10 (X)
Note: 49 is not 1 (I) less of 50 (L) because the conversion is based on decimal places

```

</div>

<strong class="example">Example 2:</strong>

<div class="example-block">

**Input:** <span class="example-io">num = 58</span>

**Output:** <span class="example-io">"LVIII"</span>

**Explanation:**

```text

50 = L
 8 = VIII

```

</div>

<strong class="example">Example 3:</strong>

<div class="example-block">

**Input:** <span class="example-io">num = 1994</span>

**Output:** <span class="example-io">"MCMXCIV"</span>

**Explanation:**

```text

1000 = M
 900 = CM
  90 = XC
   4 = IV

```

</div>

 

**Constraints:**

	- `1 <= num <= 3999`

</details>

**Category:** Tier 2 · Reinforce
**Pattern:** Greedy with value table  **Time:** O(1)  **Space:** O(1)
**Approach:** Precompute values and symbols in descending order, including the subtractive forms (900=CM, 400=CD, 90=XC, etc.). Greedily subtract the largest fitting value and append its symbol until the number reaches zero.


```java
class Solution {
    public String intToRoman(int num) {
        // Array of integer values corresponding to Roman symbols, sorted in descending order
        // It includes the 6 subtractive special cases
        int[] vals = {1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1};
        // Array of corresponding Roman numeral string representations
        String[] syms = {"M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"};
        
        // StringBuilder to accumulate the result
        StringBuilder sb = new StringBuilder();
        
        // Iterate through each value-symbol pair
        for (int i = 0; i < vals.length; i++) {
            // While the current value can be subtracted from 'num'
            while (num >= vals[i]) {
                // Subtract it
                num -= vals[i];
                // Append the corresponding symbol
                sb.append(syms[i]);
            }
        }
        
        // Return the constructed Roman numeral string
        return sb.toString();
    }
}
```

### GCD / LCM (Euclid)

<!-- Problem Statement not automatically found -->

**Category:** Tier 3 · Reference
**Pattern:** Euclidean algorithm  **Time:** O(log min(a,b))  **Space:** O(1)
**Approach:** `gcd(a, b) = gcd(b, a % b)` until the remainder is zero. LCM follows from `a / gcd(a,b) * b` — divide before multiplying to reduce overflow risk (use `long` for large inputs).


```java
class Solution {
    // Helper method to compute the Greatest Common Divisor using the Euclidean algorithm
    public long gcd(long a, long b) {
        // Continue until the remainder is 0
        while (b != 0) {
            // Temporarily store the current divisor
            long t = b;
            // The new divisor is the remainder
            b = a % b;
            // The old divisor becomes the new dividend
            a = t;
        }
        // When b is 0, a is the GCD
        return a;
    }

    // Helper method to compute the Least Common Multiple
    public long lcm(long a, long b) {
        // Formula: LCM(a, b) = |a * b| / GCD(a, b)
        // Divide first to prevent potential integer overflow during multiplication
        return a / gcd(a, b) * b;
    }
}
```

### Count Primes (Sieve of Eratosthenes)

<!-- Problem Statement not automatically found -->

**Category:** ⭐ Tier 1 · Core
**Pattern:** Sieve  **Time:** O(n log log n)  **Space:** O(n)
**Approach:** Mark multiples of each prime starting from its square as composite. Anything left unmarked below `n` is prime. Iterate `i` only up to `sqrt(n)` and start crossing out at `i*i` since smaller multiples were already handled by smaller primes.


```java
class Solution {
    public int countPrimes(int n) {
        // There are no primes strictly less than 2
        if (n < 3) return 0;
        
        // Boolean array to track composite (non-prime) numbers. Defaults to false.
        boolean[] composite = new boolean[n];
        // Variable to count the number of primes found
        int count = 0;
        
        // Loop from 2 up to n - 1
        for (int i = 2; i < n; i++) {
            // If 'i' has not been marked as composite, it must be prime
            if (!composite[i]) {
                // Increment the prime counter
                count++;
                
                // Cross out all multiples of this prime, starting from i * i
                // Use long for 'j' to avoid integer overflow when i is large
                for (long j = (long) i * i; j < n; j += i) {
                    composite[(int) j] = true;
                }
            }
        }
        
        // Return the total count of prime numbers less than n
        return count;
    }
}
```

### Reverse Integer (overflow handling)

<!-- Problem Statement not automatically found -->

**Category:** Tier 2 · Reinforce
**Pattern:** Digit pop with overflow guard  **Time:** O(log n)  **Space:** O(1)
**Approach:** Pop digits with `% 10` and push onto the reversed result. Before each push, check whether the multiply-and-add would exceed 32-bit `int` bounds; if so, return 0. This avoids relying on `long` and works for both positive and negative inputs.


```java
class Solution {
    public int reverse(int x) {
        // Variable to build the reversed integer
        int result = 0;
        
        // Loop until all digits have been processed
        while (x != 0) {
            // Extract the last digit (handles negative numbers automatically in Java)
            int digit = x % 10;
            // Remove the last digit from the number
            x /= 10;
            
            // Check for positive integer overflow before multiplying by 10 and adding the digit
            if (result > Integer.MAX_VALUE / 10 ||
                (result == Integer.MAX_VALUE / 10 && digit > 7)) return 0;
                
            // Check for negative integer overflow before multiplying by 10 and adding the digit
            if (result < Integer.MIN_VALUE / 10 ||
                (result == Integer.MIN_VALUE / 10 && digit < -8)) return 0;
                
            // Safe to append the digit to the result
            result = result * 10 + digit;
        }
        
        // Return the successfully reversed integer
        return result;
    }
}
```

### Palindrome Number

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Palindrome Number](https://leetcode.com/problems/palindrome-number/)


Given an integer `x`, return `true` if `x` is a <span data-keyword="palindrome-integer">**palindrome**</span>, and `false` otherwise.

 

<strong class="example">Example 1:</strong>

```text

**Input:** x = 121
**Output:** true
**Explanation:** 121 reads as 121 from left to right and from right to left.

```

<strong class="example">Example 2:</strong>

```text

**Input:** x = -121
**Output:** false
**Explanation:** From left to right, it reads -121. From right to left, it becomes 121-. Therefore it is not a palindrome.

```

<strong class="example">Example 3:</strong>

```text

**Input:** x = 10
**Output:** false
**Explanation:** Reads 01 from right to left. Therefore it is not a palindrome.

```

 

**Constraints:**

	- `-2<sup>31</sup> <= x <= 2<sup>31</sup> - 1`

 
**Follow up:** Could you solve it without converting the integer to a string?

</details>

**Category:** Tier 3 · Reference
**Pattern:** Reverse half the digits  **Time:** O(log n)  **Space:** O(1)
**Approach:** Negatives and numbers ending in 0 (except 0 itself) are never palindromes. Build the reversed second half digit by digit and stop when it meets or passes the remaining first half. Compare the two halves, accounting for an odd middle digit.


```java
class Solution {
    public boolean isPalindrome(int x) {
        // Negative numbers are not palindromes due to the minus sign.
        // Also, if the last digit is 0, the first digit must also be 0, which is only true for 0 itself.
        if (x < 0 || (x % 10 == 0 && x != 0)) return false;
        
        // Variable to store the reversed second half of the number
        int reverted = 0;
        
        // Continue until the original number is less than or equal to the reversed half
        while (x > reverted) {
            // Pop the last digit off 'x' and push it onto 'reverted'
            reverted = reverted * 10 + x % 10;
            x /= 10;
        }
        
        // When the length is an odd number, we can get rid of the middle digit by reverted / 10
        // (e.g., if x = 12321, at the end x = 12, reverted = 123)
        return x == reverted || x == reverted / 10;
    }
}
```

### Multiply Strings

<details><summary><b>Problem Statement & Examples</b></summary>

**LeetCode Link:** [Multiply Strings](https://leetcode.com/problems/multiply-strings/)


Given two non-negative integers `num1` and `num2` represented as strings, return the product of `num1` and `num2`, also represented as a string.

**Note:** You must not use any built-in BigInteger library or convert the inputs to integer directly.

 

<strong class="example">Example 1:</strong>

```text
**Input:** num1 = "2", num2 = "3"
**Output:** "6"

```

<strong class="example">Example 2:</strong>

```text
**Input:** num1 = "123", num2 = "456"
**Output:** "56088"

```

 

**Constraints:**

	- `1 <= num1.length, num2.length <= 200`

	- `num1` and `num2` consist of digits only.

	- Both `num1` and `num2` do not contain any leading zero, except the number `0` itself.

</details>

**Category:** Tier 3 · Reference
**Pattern:** Grade-school multiplication  **Time:** O(m·n)  **Space:** O(m+n)
**Approach:** Multiply each pair of digits and place the product into a result array where digits `i` and `j` contribute to positions `i+j` and `i+j+1`. Accumulate carries in a second pass, then strip leading zeros. This handles arbitrarily large numbers without overflow.


```java
class Solution {
    public String multiply(String num1, String num2) {
        // If either number is "0", the product is "0"
        if (num1.equals("0") || num2.equals("0")) return "0";
        
        // Lengths of the two strings
        int m = num1.length(), n = num2.length();
        
        // Array to hold the intermediate results. The maximum possible length is m + n
        int[] res = new int[m + n];
        
        // Multiply each digit of num1 by each digit of num2, starting from the least significant digit
        for (int i = m - 1; i >= 0; i--) {
            for (int j = n - 1; j >= 0; j--) {
                // Calculate the product of the two digits
                int mul = (num1.charAt(i) - '0') * (num2.charAt(j) - '0');
                
                // Indices in the result array where this product will be added
                int p1 = i + j, p2 = i + j + 1;
                
                // Add the previous carry (if any) to the current product
                int sum = mul + res[p2];
                
                // The unit digit stays at p2
                res[p2] = sum % 10;
                
                // The carry is added to the next higher position, p1
                res[p1] += sum / 10;
            }
        }
        
        // StringBuilder to convert the array back into a string
        StringBuilder sb = new StringBuilder();
        for (int d : res) {
            // Skip leading zeros
            if (!(sb.length() == 0 && d == 0)) {
                sb.append(d);
            }
        }
        
        // Return the final string representation, fallback to "0" if empty
        return sb.length() == 0 ? "0" : sb.toString();
    }
}
```
