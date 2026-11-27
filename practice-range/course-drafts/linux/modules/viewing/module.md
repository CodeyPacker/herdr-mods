---
id: course:linux/module/viewing
title: Read and search files
requires: []
outcomes: []
tasks: []
drills: []
---

Most work on a server is reading: a configuration file, a log, the output of a command. This module covers the tools for looking at text, for finding lines inside files, and for finding files by name, size or age.

## Looking at a file

Several commands show a file's contents. Which one fits depends on the file's size.

| Command | Use it for |
| --- | --- |
| `cat file` | A short file. Prints all of it at once |
| `less file` | A long file. Shows one screen at a time |
| `head file` | The first 10 lines |
| `tail file` | The last 10 lines |
| `wc -l file` | How many lines it has |

Running `cat` on a 2 GB log floods the terminal. Check the size first with `ls -lh` or `wc -l`, and use `less` for anything long.

```bash example view readonly
cat /etc/hostname            # one line: fine for cat
wc -l /var/log/syslog        # 184213 /var/log/syslog
head -n 5 /var/log/syslog    # the first 5 lines
tail -n 20 /var/log/syslog   # the last 20 lines
less /var/log/syslog         # browse it
```

## Using less

`less` is the tool you will use most for reading, so its keys are worth learning.

| Key | Does |
| --- | --- |
| Space, `b` | Forward and back one screen |
| `g`, `G` | Jump to the start, jump to the end |
| `/word` | Search forward for a word |
| `?word` | Search backward |
| `n`, `N` | Next match, previous match |
| `F` | Follow the file as it grows. Ctrl+C stops following |
| `q` | Quit |

`less` does not load the whole file, so it opens a huge log at once. Manual pages are shown with it, which is why the same keys work there.

## Watching a file grow

Logs are written continuously. `tail -f` prints the end of a file and then keeps printing new lines as they arrive, until you press Ctrl+C.

```bash example follow readonly
tail -f /var/log/app.log               # follow one file
tail -n 100 -f /var/log/app.log        # start 100 lines back
tail -F /var/log/app.log               # keep following if the file
                                       # is replaced (log rotation)
```

This is the usual way to watch what a service does while you send it a request from another terminal.

## Searching inside files

`grep` prints the lines of a file that match a pattern. It is the most used search tool on Linux.

```bash example grep readonly
grep "timeout" app.log               # lines containing "timeout"
grep -i "error" app.log              # ignore upper and lower case
grep -n "error" app.log              # show line numbers
grep -c "error" app.log              # count the matching lines
grep -v "DEBUG" app.log              # lines that do NOT match
grep -r "db_host" /etc/myapp/        # search every file in a tree
grep -l "db_host" /etc/myapp/*       # only the names of matching files
grep -A 3 -B 1 "Traceback" app.log   # 3 lines after, 1 before each
```

`-A`, `-B` and `-C` show the lines around each match. An error message is usually explained by the lines just before and after it.

`grep` also sets its exit status: 0 when something matched, 1 when nothing did. That makes it usable as a test in scripts.

## Patterns

The pattern `grep` takes is a **regular expression**: a small language for describing text. A few pieces cover most needs.

| Pattern | Matches |
| --- | --- |
| `abc` | Those characters |
| `.` | Any one character |
| `^` | The start of a line |
| `$` | The end of a line |
| `[0-9]` | One digit |
| `[a-z]` | One lower-case letter |
| `*` | The item before it, zero or more times |
| `\.` | A real dot |

Add `-E` for the extended syntax, which also has `+` (one or more), `?` (optional), `|` (or) and `( )` for grouping.

Put the pattern in single quotes. Characters such as `*`, `$` and `|` mean something to the shell as well, and without quotes the shell changes them before `grep` sees them.

```bash example regex readonly
grep '^ERROR' app.log                 # lines that start with ERROR
grep 'failed$' app.log                # lines that end with "failed"
grep -E 'error|warn|fatal' app.log    # any of the three words
grep -E ' 5[0-9][0-9] ' access.log    # status codes 500 to 599
grep -F '10.0.1.5' access.log         # -F: plain text, dots are dots
```

`-F` treats the pattern as plain text. It is the safe choice when you are searching for something that contains dots or other special characters and want no surprises.

## What matches {prediction}

A file contains these four lines: `error: disk full`, `no errors found`, `ERROR: timeout`, and `warning: slow`. Someone runs `grep '^error' file`.

:::question grep-anchor
Which lines are printed?
- [x] Only `error: disk full` :: `^` anchors the match to the start of the line, and the search is case-sensitive.
- [ ] `error: disk full` and `no errors found` :: The second line contains "error", though not at the start. The `^` rules it out.
- [ ] `error: disk full` and `ERROR: timeout` :: Upper and lower case differ unless `-i` is given.
:::

## Finding files

`grep` looks inside files. `find` looks for the files themselves, by walking a directory tree and testing each entry.

```bash example find readonly
find /etc -name "*.conf"             # by name pattern
find . -iname "readme*"              # ignore case
find /var/log -type f -size +100M    # files over 100 MB
find /tmp -type f -mtime +7          # changed more than 7 days ago
find . -type d -name node_modules    # directories only
find /srv -user ana                  # owned by a user
find . -name "*.log" -newer ref.txt  # newer than another file
```

The shape is always `find <where> <tests>`. Tests are combined with "and" by default. `-type f` means files, and `-type d` means directories.

Quote the name pattern. Without quotes, the shell expands `*.conf` against the current directory before `find` runs, and the search is then for the wrong thing.

## Acting on what find returns

`find` can run a command on each result.

```bash example find-exec readonly
# show details of each file found
find /var/log -name "*.gz" -exec ls -lh {} \;

# search inside only the files find selects
find . -name "*.yaml" -exec grep -l "replicas" {} +

# delete: run it with -print first, read the list, then switch
find /tmp -type f -mtime +7 -print
find /tmp -type f -mtime +7 -delete
```

`{}` stands for the file found. Ending with `\;` runs the command once per file, and ending with `+` passes many files to one run, which is faster.

Always run the search with `-print` before adding `-delete`. The tests decide what is destroyed, and a mistake in one cannot be undone.

## Files that are not text

Some files are not meant to be read as text: images, archives, compiled programs. Printing one to the terminal shows garbage and can leave the terminal in an odd state. The command `reset` restores it.

`file` tells you what something is, by looking at its contents and not at its name.

```bash example file readonly
ana@web01:~$ file report.pdf backup.tar.gz script.sh
report.pdf:    PDF document, version 1.7
backup.tar.gz: gzip compressed data
script.sh:     Bourne-Again shell script, ASCII text executable
```

Compressed logs are common. `zcat`, `zless` and `zgrep` work like `cat`, `less` and `grep` on `.gz` files without unpacking them first.

## Comparing two files

`diff` shows the lines that differ between two files. It is how you find out what changed in a configuration file.

```bash example diff readonly
ana@web01:~$ diff -u nginx.conf.bak nginx.conf
--- nginx.conf.bak
+++ nginx.conf
@@ -12,7 +12,7 @@
     server_name shop.example.com;
-    client_max_body_size 1m;
+    client_max_body_size 20m;
     location / {
```

In the `-u` format, a line starting with `-` is only in the first file, and one starting with `+` is only in the second. Lines with neither are unchanged context.

## Unquoted pattern {prediction}

In a directory that contains `app.conf` and `db.conf`, someone runs `find /etc -name *.conf` without quotes.

:::question find-quote
What happens?
- [ ] It finds every `.conf` file under `/etc` :: The shell expands the pattern first, against the current directory.
- [x] The shell turns it into `find /etc -name app.conf db.conf`, and `find` reports an error :: The pattern matched two local files, so `find` receives two names where it expects one. With one local match it would run and quietly search for only that name.
- [ ] It searches the current directory, not `/etc` :: The search still starts at `/etc`. What changed is the name being looked for.
:::

## Exercise: investigate a log {independent}

A web server writes one line per request to `/var/log/web/access.log`, about 3 million lines a day. Each line has the client address, the time, the request and a status code, such as:

```text
203.0.113.9 [04/Mar/2025:14:02:11] "GET /api/orders/88 HTTP/1.1" 500 0.841
```

Write a command for each task.

1. Find out how large the file is and how many lines it has, without printing it.
2. Show the last 50 lines.
3. Watch new requests arrive.
4. Count how many requests returned status 500.
5. Show the requests to `/api/orders` that did not return 200.
6. Find every `.gz` file in `/var/log/web` that is over 30 days old, and list them with their sizes.

## One possible answer {walkthrough}

```bash example log-answer readonly
# 1
ls -lh /var/log/web/access.log
wc -l /var/log/web/access.log

# 2
tail -n 50 /var/log/web/access.log

# 3
tail -F /var/log/web/access.log

# 4
grep -c '" 500 ' /var/log/web/access.log

# 5
grep '/api/orders' /var/log/web/access.log | grep -v '" 200 '

# 6
find /var/log/web -name "*.gz" -mtime +30 -exec ls -lh {} +
```

**Notes**

- In tasks 4 and 5, the pattern includes the quote and the spaces around the number. Plain `grep 500` would also match a response time of `0.500`, an address containing 500 and order number 5001. Anchor a pattern to what surrounds the value you mean.
- Task 5 joins two commands with `|`, which passes the output of the first to the second. That is the subject of the next module. The first `grep` keeps the order requests, and the second removes the successful ones.
- In task 3, `-F` keeps working when the log is rotated at midnight. `-f` would go on watching the old, renamed file.
- Task 6 only lists. Deleting would be the same search with `-delete`, after reading the list.
