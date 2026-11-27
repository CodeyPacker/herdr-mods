---
id: course:linux/module/pipes
title: Pipes and redirection
requires: []
outcomes: []
tasks: []
drills: []
---

Linux commands are small tools that each do one job. Their power comes from joining them. This module covers the three streams every program has, how to send them to files, and how to feed the output of one command into the next.

## Three streams

Every program starts with three channels already open.

| Stream | Number | Normally connected to | Used for |
| --- | --- | --- | --- |
| Standard input (stdin) | 0 | The keyboard | Data the program reads |
| Standard output (stdout) | 1 | The terminal | The program's results |
| Standard error (stderr) | 2 | The terminal | Error messages and diagnostics |

Both outputs appear on the same screen, so they look like one. They are separate, and that separation is useful. The results of a command can be saved to a file or passed to another program while its error messages still reach you.

A program does not know or care what its streams are connected to. The shell sets them up before the program starts. Redirection and pipes are the shell connecting those streams to something else.

```text example streams readonly
                    +-------------+
   stdin  (0) ----> |             | ----> stdout (1)   results
   keyboard         |   program   |
                    |             | ----> stderr (2)   errors
                    +-------------+
                                          both go to the terminal
                                          unless you redirect them
```

## Sending output to a file

`>` sends standard output to a file. `>>` does the same and adds to the end.

```bash example redirect-out readonly
ls -l /etc > listing.txt       # write the output to a file
date >> run.log                # add a line to the end of a file
echo "done" >> run.log
> empty.txt                    # create or empty a file
```

`>` replaces the file's contents. If the file exists, what it held is gone before the command even starts. `>>` keeps what is there. Mixing the two up is a common way to lose a file.

One trap follows from that. In `sort data.txt > data.txt`, the shell empties `data.txt` first, and then `sort` reads an empty file. Write to a different name and rename it afterwards.

## Errors are a separate stream

`>` moves only standard output. Error messages still go to the terminal.

```bash example redirect-err readonly
ana@web01:~$ ls /etc/hostname /no/such > out.txt
ls: cannot access '/no/such': No such file or directory

ana@web01:~$ cat out.txt
/etc/hostname
```

To redirect standard error, name its number.

```bash example redirect-both readonly
cmd 2> errors.txt              # errors to a file, results to the screen
cmd > out.txt 2> errors.txt    # each to its own file
cmd > all.txt 2>&1             # both into the same file
cmd &> all.txt                 # the same, shorter (Bash)
cmd 2> /dev/null               # throw the errors away
cmd > /dev/null 2>&1           # throw everything away
```

`2>&1` means "send stream 2 to wherever stream 1 is going now". The order matters: it must come after the redirection of stream 1.

`/dev/null` is a special file that discards everything written to it. Sending errors there hides them, which is occasionally what you want and often a way to hide the reason something failed.

## Where does it go {prediction}

A script runs `backup.sh > backup.log` every night. The backup has been failing for a week, and `backup.log` is empty each morning.

:::question stderr
Why is the log empty?
- [ ] The script produces no output at all :: A failing program almost always says something. It says it on the other stream.
- [x] The error messages go to standard error, which was not redirected :: `>` captures only standard output. The errors were written to a terminal nobody was watching. Use `> backup.log 2>&1`.
- [ ] `>` cannot write to a file that already exists :: It can. It replaces the contents each time.
:::

## Reading input from a file

`<` connects a file to a program's standard input.

```bash example redirect-in readonly
sort < names.txt               # sort reads the file on stdin
mysql shop < schema.sql        # feed a file of commands to a program
```

Many commands accept a file name as an argument too, so `sort names.txt` does the same as the first line. When no file is named, they read standard input. That behaviour is what makes pipes work.

## Pipes

A **pipe**, written `|`, connects the standard output of one command to the standard input of the next. The data passes straight from one program to the other without touching a file.

```bash example pipe readonly
ls -l /var/log | less                  # browse a long listing
grep "error" app.log | wc -l           # count matching lines
ps aux | grep nginx                    # find a process by name
history | tail -n 20                   # the last 20 commands
cat access.log | grep " 500 " | less   # filter, then browse
```

Any number of commands can be joined. Each one reads what the one before wrote, does its small job and passes the result on. A chain of them is called a **pipeline**.

The commands in a pipeline run at the same time. The first does not finish before the second starts. Data flows through as it is produced, so a pipeline can process a file far larger than memory.

```text example pipeline readonly
   grep " 500 " access.log  |  sort  |  uniq -c  |  head -n 5

   +------+ stdout  stdin +------+      +------+      +------+
   | grep | ------------> | sort | ---> | uniq | ---> | head | --> screen
   +------+               +------+      +------+      +------+

   Each program's stderr still goes to the terminal.
```

## Only standard output goes down the pipe

A pipe carries standard output. Standard error skips it and goes to the terminal. That is usually what you want: errors are not mixed into the data being processed.

To send errors through the pipe as well, merge them first with `2>&1`.

```bash example pipe-err readonly
make 2>&1 | less               # page through output and errors together
make 2>&1 | grep -i warning    # search both streams
```

## Save and show

`tee` copies its input to a file and also passes it on. Use it to keep a record of output while still watching it.

```bash example tee readonly
make 2>&1 | tee build.log              # watch the build and save it
./deploy.sh | tee -a deploy.log        # -a adds to the end of the file
ls /etc | tee listing.txt | wc -l      # save the list, print the count
```

## The exit status of a pipeline

The exit status of a pipeline is the status of its last command. The earlier ones are ignored.

```bash example pipe-status readonly
ana@web01:~$ cat /no/such/file | wc -l
cat: /no/such/file: No such file or directory
0
ana@web01:~$ echo $?
0
```

`cat` failed, `wc` succeeded in counting nothing, and the pipeline reports success. A script that checks only the final status will carry on as if all were well.

In Bash, `set -o pipefail` changes this, so a pipeline fails if any command in it failed. Scripts should turn it on. The scripts module returns to it.

## Using output as arguments

A pipe gives a command data on its standard input. Sometimes you need the output of one command as the arguments of another. There are two ways.

**Command substitution** runs a command and puts its output into the command line.

```bash example substitution readonly
echo "Today is $(date +%A)"
cd "$(dirname /srv/app/config/app.yaml)"
grep -l "TODO" $(find . -name "*.md")
```

**`xargs`** reads items from standard input and runs a command with them as arguments.

```bash example xargs readonly
find . -name "*.tmp" | xargs rm                  # delete what find lists
find . -name "*.tmp" -print0 | xargs -0 rm       # safe with odd names
cat hosts.txt | xargs -I {} ping -c 1 {}         # run once per line
```

File names with spaces break the plain form, since `xargs` splits on spaces. The `-print0` and `-0` pair separates names with a null character, which cannot appear in a name. Use that pair whenever names come from `find`.

## Here documents

A **here document** feeds several lines of text to a command's standard input, written right in the command or script.

```bash example heredoc readonly
cat > /tmp/note.txt <<EOF
Deployed by $USER
on $(hostname)
EOF
```

Everything up to the closing word is the input. Variables and command substitutions inside are expanded. Quote the opening word, as in `<<'EOF'`, to keep the text exactly as written.

## Which gets counted {prediction}

Someone wants to know how many errors a command prints, and runs `./check.sh | wc -l`. The command prints 40 error lines to standard error and 3 result lines to standard output.

:::question pipe-count
What does `wc -l` print, and what appears on the screen?
- [ ] 43, and nothing else :: The pipe carries only standard output.
- [x] 3, and the 40 error lines appear on the screen :: Standard error does not go through the pipe. Only the 3 result lines reach `wc`. To count the errors, use `./check.sh 2>&1 >/dev/null | wc -l`.
- [ ] 40, and the 3 result lines appear on the screen :: It is the other way round. Standard output is what goes into the pipe.
:::

## Exercise: build the pipelines {independent}

Write one command line for each task.

1. Run `./migrate.sh`, saving results and errors together in `migrate.log`, while also watching them.
2. Run `./cleanup.sh` so that its results are discarded and its errors are saved to `cleanup.err`.
3. Count how many files under `/etc` have names ending in `.conf`, hiding any "Permission denied" messages.
4. Show the 10 largest files in `/var/log`. `du -a /var/log` prints a size and a path for each file, and `sort -n` sorts by number.
5. Add a line with the current date and the text "backup started" to the end of `/var/log/backup.log`.
6. Explain what is wrong with `sort users.txt > users.txt`, and fix it.

## One possible answer {walkthrough}

```bash example pipes-answer readonly
# 1
./migrate.sh 2>&1 | tee migrate.log

# 2
./cleanup.sh > /dev/null 2> cleanup.err

# 3
find /etc -name "*.conf" 2> /dev/null | wc -l

# 4
du -a /var/log 2> /dev/null | sort -n | tail -n 10

# 5
echo "$(date) backup started" >> /var/log/backup.log

# 6
sort users.txt > users.sorted && mv users.sorted users.txt
```

**Notes**

- In task 1, `2>&1` comes before the pipe, so both streams enter it. `tee` then writes the file and shows the same text.
- In task 3, only the error stream is discarded. The list of names still goes down the pipe to be counted.
- In task 4, `sort -n` puts the largest last, so `tail` takes the final ten. `sort -n -r | head -n 10` is equally good.
- In task 5, `>>` is essential. `>` would wipe the log each time.
- In task 6, the shell empties `users.txt` before `sort` starts, so `sort` reads nothing and the file ends up empty. Writing to a second file and renaming it avoids that, and `&&` means the rename happens only if the sort succeeded. `sort -o users.txt users.txt` also works, since `sort` handles that case itself.
