---
id: course:linux/module/text
title: Process text
requires: []
outcomes: []
tasks: []
drills: []
---

Logs, configuration and command output are all lines of text. A handful of small tools, joined with pipes, can answer most questions about them. This module covers sorting, counting, picking out columns and changing text.

## Lines and fields

Text tools share one view of the world. Input is a series of **lines**. Each line may be split into **fields** by a separator: spaces, tabs, commas or colons.

Most of the work is a combination of four steps.

1. **Select** the lines you want (`grep`).
2. **Extract** the field you care about (`cut`, `awk`).
3. **Sort and count** (`sort`, `uniq`, `wc`).
4. **Change** text (`sed`, `tr`).

Build a pipeline one step at a time. Run the first command and look at the output. Add the next and look again. A long pipeline written in one go is hard to get right and harder to debug.

## Sorting

`sort` puts lines in order.

```bash example sort readonly
sort names.txt               # alphabetical
sort -r names.txt            # reversed
sort -n sizes.txt            # by number
sort -h sizes.txt            # by size with units: 2K, 10M, 1G
sort -u names.txt            # sorted, with duplicates removed
sort -t, -k3 -n data.csv     # by the 3rd comma-separated field, numeric
```

The default order is by character, not by value. As text, `10` comes before `9`, since `1` comes before `9`. Use `-n` whenever the lines are numbers.

`-t` sets the field separator and `-k` chooses the field to sort on.

## Counting repeats

`uniq` collapses neighbouring lines that are identical. It compares only lines that are next to each other, so its input must be sorted first.

```bash example uniq readonly
sort names.txt | uniq         # each distinct line once
sort names.txt | uniq -c      # each distinct line, with a count
sort names.txt | uniq -d      # only the lines that repeat
```

The combination below is one of the most useful in all of shell work. It answers "what are the most common values?".

```bash example top-n readonly
... | sort | uniq -c | sort -n -r | head

# sort         bring equal lines together
# uniq -c      one line per value, with its count in front
# sort -n -r   the largest count first
# head         the top ten
```

## Picking columns with cut

`cut` extracts fields from each line, given a separator.

```bash example cut readonly
cut -d: -f1 /etc/passwd            # first colon-separated field
cut -d, -f2,5 data.csv             # fields 2 and 5 of a CSV
cut -c1-10 file.txt                # characters 1 to 10
```

`-d` sets the separator and `-f` names the fields. `cut` is strict: it splits on every single separator character. Columns padded with several spaces, as in the output of `ls -l` or `ps`, produce empty fields and wrong results. For those, use `awk`.

## Picking columns with awk

`awk` splits each line into fields on any run of spaces or tabs, and lets you print the ones you want. The fields are named `$1`, `$2` and so on. `$0` is the whole line, and `$NF` is the last field.

```bash example awk readonly
ps aux | awk '{print $1, $11}'          # user and command
df -h | awk '{print $5, $6}'            # use% and mount point
awk -F: '{print $1}' /etc/passwd        # -F sets the separator
awk '{print $NF}' access.log            # the last field of each line
awk '$9 == 500' access.log              # lines whose 9th field is 500
awk '$9 >= 500 {print $7}' access.log   # the 7th field of those lines
awk '{sum += $10} END {print sum}' access.log     # add up a column
```

An `awk` program has the shape `condition { action }`. With no condition, the action runs for every line. With no action, matching lines are printed. `END { ... }` runs once after the last line.

`awk` is a complete language. The small part shown here, printing fields and filtering on them, covers most daily use. Put the program in single quotes, so the shell leaves `$1` alone.

## Top talkers {prediction}

An access log has the client address as the first field of each line. Someone runs:

```bash
awk '{print $1}' access.log | uniq -c | sort -n -r | head -n 3
```

:::question uniq-sorted
The result shows the same address several times, each with a small count. Why?
- [ ] `head -n 3` cut the list too short :: A longer list would show the same problem: one address on many lines.
- [x] `uniq` only merges lines that are next to each other, and the addresses were not sorted first :: Requests from one address are scattered through the log. Without `sort` before `uniq -c`, each separate run is counted on its own.
- [ ] `awk` printed the wrong field :: The addresses are correct. They are simply not grouped.
:::

## Translating characters

`tr` replaces or deletes single characters. It reads standard input only.

```bash example tr readonly
echo "Hello World" | tr 'a-z' 'A-Z'      # HELLO WORLD
echo "a,b,c" | tr ',' '\n'               # one item per line
tr -d '\r' < windows.txt > unix.txt      # delete carriage returns
echo "too    many   spaces" | tr -s ' '  # squeeze repeats into one
```

The third line fixes a frequent problem. Text files made on Windows end each line with two characters, a carriage return and a line feed. Linux expects only the line feed. A script with Windows line endings fails with confusing errors such as `bad interpreter` or `command not found` for a command that plainly exists.

## Replacing text with sed

`sed` edits text as it flows past. Its most used command is substitution: `s/old/new/`.

```bash example sed readonly
sed 's/http:/https:/' urls.txt          # first match on each line
sed 's/http:/https:/g' urls.txt         # every match (g = global)
sed 's|/var/www|/srv/www|g' site.conf   # another separator, for paths
sed -n '10,20p' big.log                 # print only lines 10 to 20
sed '/^#/d' app.conf                    # delete comment lines
sed '/^$/d' app.conf                    # delete empty lines
```

`sed` prints the changed text and leaves the file alone. To change the file itself, add `-i`.

```bash example sed-inplace readonly
sed -i.bak 's/DEBUG/INFO/' app.conf     # edit the file, keep app.conf.bak
```

Editing in place has no undo. Run the command without `-i` first and read the output. When you do use `-i`, give it a suffix, as in `-i.bak`, so that a copy of the original is kept.

The "old" part is a regular expression, so characters such as `.` and `*` have special meaning there. `s/1.5/2.0/` also changes `105` and `1x5`, since the dot matches any character. Write `1\.5` for a real dot.

## Counting

`wc` counts lines, words and bytes.

```bash example wc readonly
wc -l app.log                # lines
wc -w essay.txt              # words
wc -c image.png              # bytes
ls /etc | wc -l              # how many entries in a directory
grep -c "error" app.log      # count matches without needing wc
```

## Putting them together

A realistic question: which request paths produced the most server errors today?

```bash example combined readonly
grep '04/Mar/2025' access.log \
  | awk '$9 >= 500 {print $7}' \
  | sort \
  | uniq -c \
  | sort -n -r \
  | head -n 5

#  412 /api/orders
#   88 /api/checkout
#   31 /api/search
#    4 /health
#    1 /api/users/55
```

Read it one step at a time: keep today's lines, keep the path of those with a status of 500 or more, group equal paths, count them, and put the largest first.

A backslash at the end of a line continues the command on the next line. It makes a long pipeline readable.

## When to stop

These tools are excellent for questions asked once at a terminal. They are a poor fit for some jobs.

- **Structured formats.** JSON, YAML and XML have rules that line-based tools do not understand. A value may span lines or contain the separator. Use a tool made for the format, such as `jq` for JSON.
- **CSV with quoted fields.** `"Smith, Ana",42` has a comma inside a field. `cut -d,` splits it in the wrong place.
- **Anything that will be kept and maintained.** A forty-line pipeline of `sed` and `awk` is hard to read and to test. When a one-off turns into a program, write it in a programming language.

```bash example jq readonly
# with a tool that understands the format
curl -s https://api.example.com/orders | jq '.items[].id'
```

## The dot {prediction}

A configuration file contains `version=1.5` and `timeout=105`. Someone runs `sed -i 's/1.5/2.0/g' app.conf` to update the version.

:::question sed-dot
What does the file contain afterwards?
- [ ] `version=2.0` and `timeout=105` :: The dot in the pattern is not a literal dot.
- [x] `version=2.0` and `timeout=2.0` :: In a regular expression, `.` matches any character, so `105` matches `1.5` too. The pattern should be `1\.5`, and the change should have been previewed without `-i`.
- [ ] Nothing changes, since the pattern needs quotes :: It is quoted, and it matches. It matches more than was intended.
:::

## Exercise: answer from the data {independent}

The file `/etc/passwd` has one line per user account, with fields separated by colons. The first field is the user name, the third is the numeric user ID, and the seventh is the user's shell:

```text
ana:x:1001:1001:Ana Ruiz:/home/ana:/bin/bash
```

An access log has lines in this form, with fields separated by spaces: the client address, the time, the method, the path, the status and the response size in bytes.

```text
203.0.113.9 14:02:11 GET /api/orders 200 5120
```

Write a pipeline for each question.

1. List all user names, sorted.
2. Show how many accounts use each shell, most common first.
3. Show the names of accounts whose user ID is 1000 or more.
4. Show the 5 client addresses that made the most requests.
5. Show the total number of bytes sent.
6. Print the log with every `/api/` path changed to `/v2/api/`, without changing the file.

## One possible answer {walkthrough}

```bash example text-answer readonly
# 1
cut -d: -f1 /etc/passwd | sort

# 2
cut -d: -f7 /etc/passwd | sort | uniq -c | sort -n -r

# 3
awk -F: '$3 >= 1000 {print $1}' /etc/passwd

# 4
awk '{print $1}' access.log | sort | uniq -c | sort -n -r | head -n 5

# 5
awk '{sum += $6} END {print sum}' access.log

# 6
sed 's|/api/|/v2/api/|g' access.log
```

**Notes**

- In tasks 1 and 2, `cut` is right, since `/etc/passwd` uses exactly one colon between fields. For the access log, `awk` is the safer choice.
- Task 3 needs a numeric comparison on a field, which `cut` and `grep` cannot do. `awk` with `-F:` can.
- Task 4 is the standard counting pattern. The `sort` before `uniq -c` is what groups the addresses.
- In task 6, `|` is used as the separator in the `sed` command, since the text contains slashes. With `/` as the separator, every slash in the paths would need a backslash. There is no `-i`, so the file is untouched.
