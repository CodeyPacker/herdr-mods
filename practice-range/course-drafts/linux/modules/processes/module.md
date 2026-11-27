---
id: course:linux/module/processes
title: Processes and signals
requires: []
outcomes: []
tasks: []
drills: []
---

A running program is a process. This module covers how to see what is running, how to stop it properly, and how to keep something running after you log out.

## What a process is

A **process** is one running instance of a program. Starting the same program twice gives two processes.

Each process has:

- a **process ID** (PID), a number that identifies it while it lives,
- a **parent**, the process that started it,
- an **owner**, the user it runs as, which decides what it may touch,
- its own memory, open files and environment.

Processes form a tree. When the system boots, the first process starts (PID 1, usually `systemd`), and everything else descends from it. Your shell is a process, and each command you run is a child of it.

```text example proc-tree readonly
   systemd (1)
   +-- sshd (812)
   |     +-- sshd: ana (4410)
   |           +-- bash (4411)
   |                 +-- tail -f app.log (4502)
   +-- nginx (903)
   |     +-- nginx: worker (904)
   |     +-- nginx: worker (905)
   +-- postgres (1120)
```

## Seeing what is running

`ps` lists processes. On its own it shows only those of your current terminal. Two forms show everything.

```bash example ps readonly
ps aux                     # every process, with owner, CPU and memory
ps -ef                     # every process, with the parent's PID
ps aux | grep nginx        # find one by name
pgrep -a nginx             # the same, more directly
ps -o pid,ppid,user,stat,cmd -p 903     # chosen columns for one PID
```

```text example ps-output readonly
USER       PID %CPU %MEM    VSZ   RSS STAT START   TIME COMMAND
root         1  0.0  0.1 168140 11200 Ss   Mar01   0:09 /sbin/init
www-data   904  1.2  0.8 142300 66100 S    09:14   0:41 nginx: worker
postgres  1120  0.3  3.1 412800 251000 Ss  Mar01   2:10 postgres
ana       4502  0.0  0.0   8100   900 S+   14:02   0:00 tail -f app.log
```

Read `USER` to see whose rights the process has, `%CPU` and `%MEM` for what it is using, and `RSS` for the memory it actually holds, in kilobytes.

## Watching live

`top` shows the same information, refreshed every few seconds, sorted by processor use. `htop` is a friendlier version, where installed.

```bash example top readonly
top                 # live view. q quits
top -o %MEM         # sorted by memory
htop                # easier to read, if it is installed
```

In `top`, press `M` to sort by memory and `P` to sort by processor. The top lines summarise the whole machine: load, memory in use and the number of processes. A later module explains those figures.

## Signals

You do not stop a process by reaching in and removing it. You send it a **signal**: a small numbered message from the system. The process can react to most signals in its own way.

| Signal | Number | Meaning | Can the process handle it? |
| --- | --- | --- | --- |
| `SIGTERM` | 15 | Please finish and exit | Yes |
| `SIGINT` | 2 | Interrupt. Sent by Ctrl+C | Yes |
| `SIGHUP` | 1 | The terminal closed. Many services reload their configuration | Yes |
| `SIGKILL` | 9 | Stop now | No |
| `SIGSTOP` | 19 | Pause | No |
| `SIGCONT` | 18 | Resume after a pause | Yes |

`kill` sends a signal. Despite its name, its default is the polite one, `SIGTERM`.

```bash example kill readonly
kill 4502                # send SIGTERM: ask it to stop
kill -TERM 4502          # the same, written out
kill -HUP 903            # ask a service to reload its configuration
kill -KILL 4502          # force it. Also written kill -9
pkill -f "tail -f"       # signal processes by matching the command
```

## Ask first, force last

`SIGTERM` gives a program the chance to stop properly: finish the request it is handling, write its data, close its files, remove its lock file.

`SIGKILL` gives it nothing. The kernel removes the process at once. Whatever it was doing is cut off in the middle. A database killed this way has to recover when it next starts. A program writing a file leaves it half written. A lock file stays behind and may stop the next start.

So the order is always the same.

1. Send `SIGTERM`.
2. Wait a few seconds.
3. Only if it is still running, send `SIGKILL`.

Reaching for `kill -9` first is a habit worth unlearning. Container platforms and service managers follow the same order: a stop request sends `SIGTERM`, waits for a set time and then sends `SIGKILL`.

```text example term-kill readonly
   SIGTERM (15)                        SIGKILL (9)

   the program is told                 the program is not told
   it finishes current work            it is removed mid-step
   it saves and closes files           files may be half written
   it exits by itself                  locks and temp files remain

   use first                           use only if SIGTERM is ignored
```

## Which signal {prediction}

A database process is slow to respond. An engineer wants to restart it and runs `kill -9` on its PID straight away.

:::question kill-nine
What is the risk?
- [ ] None. `kill -9` is the standard way to stop a process :: It is the last resort. The standard way is `SIGTERM`.
- [x] The database gets no chance to finish its writes and close cleanly, and must recover at the next start :: `SIGKILL` cannot be handled. Work in progress is cut off. A database is built to survive that, and recovery takes time and is a risk that `SIGTERM` would have avoided.
- [ ] The signal is ignored, since databases block signal 9 :: No process can block or ignore `SIGKILL`.
:::

## Foreground and background

A command you start normally runs in the **foreground**. The shell waits for it, and your keyboard is connected to it.

Adding `&` starts it in the **background**. The shell gives the prompt back at once.

```bash example jobs readonly
./long-task.sh &          # start in the background
jobs                      # list this shell's background jobs
fg %1                     # bring job 1 to the foreground
# Ctrl+Z                  pause the foreground job
bg %1                     # let a paused job continue in the background
wait                      # wait for all background jobs to finish
```

A background job still writes to your terminal, which makes a mess, so its output is usually redirected to a file.

## Surviving a logout

A background job belongs to your shell. When you log out, or an SSH connection drops, the shell sends its jobs `SIGHUP`, and they stop. A long task started over SSH therefore dies with the connection.

There are three ways to prevent that, from simplest to best.

```bash example nohup readonly
nohup ./long-task.sh > task.log 2>&1 &    # ignore the hangup signal

tmux new -s work          # a terminal session that lives on the server
# ... start the task, then press Ctrl+B and D to detach ...
tmux attach -t work       # come back later, from any connection
```

- `nohup` makes the command ignore the hangup. It is good enough for a single task.
- `tmux` (or `screen`) keeps a whole terminal session alive on the server. You can disconnect and return to it. It is the right tool for long interactive work.
- For anything that should always be running, such as an application, neither is right. That is a **service**, managed by the system, which starts it at boot and restarts it when it fails. A later module covers services.

## Exit status and zombies

When a process ends, it returns its exit status to its parent, as the first module described. The parent is expected to collect it.

A process that has ended and whose parent has not yet collected its status is a **zombie**. It appears in `ps` with the state `Z`. It uses no memory or processor, only a slot in the process table. A few zombies are harmless. Many of them point to a bug in the parent program. A zombie cannot be killed, since it is already dead. It goes away when its parent collects it or itself ends.

If a parent ends first, its children are adopted by PID 1, which collects them.

## What is using the file or the port

Two questions come up constantly.

```bash example who-uses readonly
ss -ltnp                          # which process listens on which port
sudo lsof -i :8080                # what is using port 8080
lsof /var/log/app.log             # which processes have a file open
ls -l /proc/903/cwd               # a process's working directory
cat /proc/903/environ | tr '\0' '\n'      # its environment variables
```

`/proc` is a directory of information about running processes, one subdirectory per PID. It is not on disk. The kernel produces it on request.

A related surprise: deleting a file that a process still has open does not free the disk space. The name is gone and the data stays until the process closes the file. This is why deleting a huge log sometimes frees nothing, until the service that writes it is restarted.

## Priority

Every process has a **nice value** from -20 (highest priority) to 19 (lowest). A higher number is "nicer" to other processes. It matters only when the processor is contended.

```bash example nice readonly
nice -n 10 ./report.sh            # start at lower priority
renice -n 15 -p 4502              # lower the priority of a running one
```

Use it for batch work that should not disturb a live service.

## Closed laptop {prediction}

An engineer connects to a server over SSH and starts a 3-hour data import with `./import.sh &`. After 20 minutes they close their laptop and go home.

:::question hangup
What happens to the import?
- [ ] It keeps running, since `&` put it in the background :: Background means the shell does not wait for it. The job still belongs to that shell.
- [x] It is stopped when the connection drops, since the shell sends its jobs a hangup signal :: The session ends, the shell exits, and its jobs receive `SIGHUP`. Use `tmux`, or `nohup` with output redirected.
- [ ] It pauses, and resumes when they reconnect :: Nothing pauses it and nothing would resume it. A new connection is a new shell.
:::

## Exercise: manage the processes {independent}

You are on a server and need to do each of these. Write the commands.

1. Find the PID and the owner of the process listening on port 8080.
2. See which five processes use the most memory.
3. A worker process with PID 7741 is stuck. Stop it properly, and only force it if needed.
4. Ask the `nginx` master process to reload its configuration without stopping. Its PID is in `/run/nginx.pid`.
5. Start `./reindex.sh`, which takes 4 hours, so that it survives your logout, and save its output.
6. You deleted a 40 GB log file and `df` shows no space was freed. Say why, and find the process responsible.

## One possible answer {walkthrough}

```bash example proc-answer readonly
# 1
sudo ss -ltnp | grep ':8080'

# 2
ps aux --sort=-%mem | head -n 6

# 3
kill 7741
sleep 10
ps -p 7741 && kill -KILL 7741

# 4
sudo kill -HUP "$(cat /run/nginx.pid)"

# 5
nohup ./reindex.sh > reindex.log 2>&1 &

# 6
sudo lsof +L1 | grep deleted
```

**Notes**

- In task 2, `head -n 6` gives the header line plus five processes.
- In task 3, `ps -p 7741` succeeds only if the process still exists, so the `&&` sends `SIGKILL` only when `SIGTERM` did not work.
- In task 4, `SIGHUP` asks nginx to read its configuration again while it keeps serving. In practice `systemctl reload nginx` does the same and is the normal way.
- In task 5, a `tmux` session is the better choice if you want to return and watch it.
- In task 6, a process still has the deleted file open, so its data remains on disk. `lsof +L1` lists open files that no longer have a name. Restarting that process, or asking it to reopen its log, releases the space.
