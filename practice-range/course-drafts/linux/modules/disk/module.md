---
id: course:linux/module/disk
title: Disks, memory and load
requires: []
outcomes: []
tasks: []
drills: []
---

A machine has a fixed amount of disk, memory and processor. When one runs out, things fail in ways that do not always name the cause. This module covers how to measure each one and how to read the numbers.

## Disk space

`df` shows how full each filesystem is. `du` shows how much space a directory uses.

```bash example df readonly
ana@web01:~$ df -h
Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1        50G   47G  3.0G  95% /
/dev/sdb1       200G   80G  120G  40% /var/lib/postgresql
tmpfs           3.9G     0  3.9G   0% /dev/shm
```

`-h` prints sizes in readable units. Read the `Use%` column and the `Mounted on` column. Each line is a separate filesystem, attached to the tree at that directory. Here the root filesystem is nearly full and the database's is not.

A full disk causes failures that look unrelated: a service that will not start, a database that refuses writes, a login that fails, "No space left on device" from a command that seems to write nothing. Check `df` early in any investigation.

## Finding what uses the space

When a filesystem is full, find the cause from the top down.

```bash example du readonly
sudo du -sh /var/*                     # size of each directory in /var
sudo du -sh /var/* | sort -h           # sorted, largest last
sudo du -h --max-depth=1 /var/log | sort -h
sudo du -xh / --max-depth=1 | sort -h  # -x: stay on this filesystem
sudo find / -xdev -type f -size +500M  # every file over 500 MB
```

Start at the mount point, find the largest directory, and repeat inside it. Two or three rounds usually lead to the cause: logs, old releases, package caches, core dumps, container images.

`-x` (and `-xdev` for `find`) keeps the search on one filesystem. Without it, measuring `/` also counts every other disk mounted beneath it.

```text example drill readonly
   / is 95% full

   du -xh / --max-depth=1          -> /var    38G
   du -h /var --max-depth=1        -> /var/log  31G
   du -h /var/log --max-depth=1    -> /var/log/app  30G
   ls -lhS /var/log/app | head     -> debug.log  29G

   Three steps from "the disk is full" to the one file.
```

## Mounts

A **filesystem** is the structure on a disk or partition that holds files. To be used, it is **mounted**: attached to a directory in the tree, called its mount point.

```bash example mounts readonly
lsblk                    # disks and partitions, as a tree
findmnt                  # what is mounted where
mount | column -t        # the same, older style
cat /etc/fstab           # what is mounted automatically at boot
```

```text example lsblk readonly
NAME    SIZE TYPE MOUNTPOINTS
sda      50G disk
`-sda1   50G part /
sdb     200G disk
`-sdb1  200G part /var/lib/postgresql
```

This explains how one directory can be full while another has plenty of room. They are different disks. It also explains a classic accident: if a disk fails to mount, its mount point is just an empty directory on the root filesystem. A program that writes there fills the root disk, and the data vanishes from view when the real disk is mounted over it later.

## Inodes

A filesystem has a limit on its number of files as well as on bytes. Each file uses one **inode**, a record that holds its details, and the number of inodes is fixed when the filesystem is created.

A disk can report free space and still refuse to create a file, with "No space left on device". The cause is millions of tiny files, such as session files or a cache that is never cleaned.

```bash example inodes readonly
ana@web01:~$ df -i
Filesystem      Inodes   IUsed  IFree IUse% Mounted on
/dev/sda1      3276800 3276800      0  100% /
```

When `df -h` shows room and writes still fail, run `df -i`.

## Space that does not come back {prediction}

A disk is full. An engineer finds a 40 GB log file, deletes it with `rm`, and runs `df -h`. The disk is still shown as full. The application that writes the log is still running.

:::question deleted-open
Why was no space freed?
- [ ] `df` takes several minutes to update :: It reports the current state at once.
- [x] The application still has the file open, so its data stays on disk until the application closes it :: `rm` removes the name. The space is released when the last process using the file closes it. Restart the application, or have it reopen its log.
- [ ] `rm` moves files to a recycle area :: There is no recycle area on the command line.
:::

## Memory

`free` shows how memory is used.

```bash example free readonly
ana@web01:~$ free -h
        total    used    free   shared  buff/cache  available
Mem:    7.8Gi   2.1Gi   310Mi     24Mi       5.4Gi      5.4Gi
Swap:   2.0Gi      0B   2.0Gi
```

The column to read is **available**, not **free**. Linux uses memory that programs do not need to keep recently read files in memory, shown as `buff/cache`. That makes disk access much faster, and the memory is handed back the moment a program asks for it.

So a low "free" figure is normal and healthy. Here only 310 MB is free, and 5.4 GB is available. This machine has plenty of memory. A machine is short of memory when "available" is low.

**Swap** is disk space used as overflow when memory runs out. Disk is thousands of times slower than memory, so a machine that is actively swapping becomes very slow. Some swap in use is harmless. Swap that keeps growing is a sign of too little memory.

## When memory runs out

If memory and swap are both exhausted, the kernel has to free some at once. Its **OOM killer** (out of memory) picks a process, usually the largest, and kills it with `SIGKILL`.

From the outside, a service simply disappears, with nothing in its own log, since it had no chance to write anything. The evidence is in the kernel's log.

```bash example oom readonly
sudo dmesg -T | grep -i "out of memory"
journalctl -k | grep -i "killed process"

# Out of memory: Killed process 4411 (java) total-vm:8123456kB
```

A process that vanishes without an error should make you check for this. In containers the same thing happens when a container passes its own memory limit, and it is reported as "OOMKilled".

## Load

`uptime` shows how long the machine has been up and its **load average**.

```bash example uptime readonly
ana@web01:~$ uptime
 14:02:11 up 12 days,  3:41,  2 users,  load average: 3.20, 1.10, 0.45
ana@web01:~$ nproc
4
```

The three numbers are averages over the last 1, 5 and 15 minutes. Load is the number of processes that are running or waiting to run, and on Linux it also counts those waiting for disk.

Read it against the number of processor cores, shown by `nproc`.

- Load below the core count: there is spare capacity.
- Load about equal to the core count: fully used.
- Load well above it: work is queueing.

A load of 3.2 means nothing alone. On 4 cores it is comfortable. On 1 core it means a queue.

Compare the three numbers to see the trend. Here the load went from 0.45 to 3.20, so it is rising sharply and began within the last few minutes.

## What is the machine waiting for

High load has two different causes, and they need different fixes. `top` tells them apart in its summary line.

```text example top-cpu readonly
%Cpu(s): 12.0 us,  3.0 sy,  0.0 ni, 20.0 id, 64.0 wa,  0.0 hi,  1.0 si

   us   user programs
   sy   the kernel
   id   idle
   wa   waiting for disk or network storage
```

- High `us`: the processor is busy computing. Find the process using it.
- High `wa`: the processor is idle and waiting for the disk. The bottleneck is storage, and a faster processor would not help.

In this example the processor is 64% waiting for input and output. The load is high, and the cause is a slow or overloaded disk.

```bash example io readonly
vmstat 5                 # a summary every 5 seconds
iostat -x 5              # per-disk activity (package: sysstat)
sudo iotop               # which processes read and write the most
```

## A first look at any machine

When a machine is misbehaving, a fixed set of commands gives a picture in a minute.

```bash example first-look readonly
uptime                   # load, and its trend
free -h                  # memory: read "available"
df -h                    # disk space
df -i                    # inodes
top                      # which processes, and us versus wa
sudo dmesg -T | tail     # recent kernel messages, such as OOM kills
journalctl -p err -b     # errors since boot
```

Run them in this order before forming a theory. Most resource problems show up in one of these seven.

## Reading the numbers {prediction}

A 2-core server feels slow. `uptime` shows a load average of `9.50, 9.20, 8.80`. `top` shows `%Cpu(s): 4.0 us, 2.0 sy, 6.0 id, 88.0 wa`. `free -h` shows 3 GB available.

:::question iowait
What is the bottleneck?
- [ ] The processor, since the load is far above the core count :: The processor is doing almost no work: 4% user and 2% system.
- [x] Disk input and output :: 88% of processor time is spent waiting for the disk, and processes waiting for it are counted in the load. Find what is reading or writing so heavily, with `iotop`.
- [ ] Memory :: 3 GB is available, and nothing here points to swapping.
:::

## Exercise: diagnose the server {independent}

At 03:10 an alert says the orders service is down. You log in and collect this.

```text example diagnose readonly
$ uptime
 03:14:02 up 41 days,  load average: 0.30, 0.45, 2.10

$ free -h
       total   used   free  buff/cache  available
Mem:   7.8Gi  1.1Gi  5.9Gi       800Mi      6.4Gi
Swap:  2.0Gi  1.9Gi  100Mi

$ df -h /
Filesystem  Size  Used Avail Use% Mounted on
/dev/sda1    50G   31G   19G  62% /

$ systemctl status orders
   Active: failed (Result: signal) since 03:08:51
   Main PID: 4411 (code=killed, signal=KILL)

$ sudo dmesg -T | tail -n 2
[03:08:51] Out of memory: Killed process 4411 (orders)
[03:08:51] total-vm:9012345kB, anon-rss:6710000kB
```

Say what happened, citing the evidence. Explain why memory looks fine now. Say what you would do right away and what you would investigate afterwards.

## One possible answer {walkthrough}

**What happened.** The orders process grew until the machine ran out of memory, and the kernel's OOM killer ended it at 03:08:51.

**The evidence**

- `dmesg` says so directly: "Out of memory: Killed process 4411 (orders)". It held about 6.7 GB of the machine's 7.8 GB.
- `systemctl status` agrees: the process was killed by signal `KILL`, at the same second. A crash of its own making would show an exit code, not a kill signal.
- Swap is almost full, at 1.9 of 2.0 GB. The machine had used its overflow before it gave up.
- The load average of 2.10 over 15 minutes, against 0.30 now, shows the machine was struggling before the kill and is idle since.

**Why memory looks fine now.** The process that held it is gone. 6.4 GB is available because the cause was removed. A snapshot taken after the event shows the aftermath. The kernel log shows the event.

**Disk** is at 62% and is not involved.

**Right away.** Start the service: `sudo systemctl start orders`. Confirm that it answers. Note that it did not restart by itself, which suggests the unit has no `Restart=` policy, or that the policy does not cover a kill signal. That is worth fixing, as a mitigation only.

**Afterwards**

1. **Why did it grow?** Look at its memory over the last days in the monitoring data. A steady climb over 41 days points to a leak. A sudden jump at 03:00 points to a job or an unusually large request.
2. **What ran at about 03:00?** Check scheduled jobs and the service's own log just before 03:08.
3. **Set a memory limit** on the service (`MemoryMax=` in the unit), so that it is restarted cleanly at a known size and cannot take the whole machine with it.
4. **Alert on available memory and on swap use,** so the next occurrence is seen before the kill.

The restart is the quick fix, and it will fail again in the same way unless the growth is explained.
