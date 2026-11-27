---
id: course:linux/module/review
title: Diagnose a broken server
requires: []
outcomes: []
tasks: []
drills: []
---

This module has no new ideas. You work through two broken servers and review a script, using the commands from the earlier modules. Do each exercise on paper before you read its answer.

## How to use this module

Each exercise has a step where you work alone and a step with one possible answer. The answers are not the only good ones. Compare your reasoning with them, and pay most attention to anything you did not think of at all.

When something is wrong on a server, ask the same questions in the same order.

1. **What exactly is failing?** Get the real error message.
2. **Is the machine healthy?** Load, memory, disk.
3. **Is the service running?** Its status, and its last log lines.
4. **Can it be reached?** Listening address, port, firewall.
5. **What changed?** A deploy, an update, a configuration edit, a reboot.

Look before you change anything. A restart often makes the symptom go away and destroys the evidence of the cause.

## Case 1: the site is down {independent}

A website returns "502 Bad Gateway". It is served by nginx on port 80, which passes requests to an application listening on port 8000. You log in and collect the following. Work out what is wrong and what you would do.

```text example case1 readonly
$ systemctl status nginx
   Active: active (running) since Mon 2025-03-03 08:00:11 UTC

$ systemctl status app
   Active: activating (auto-restart) (Result: exit-code)
   Process: 9911 ExecStart=/srv/app/bin/server (code=exited, status=1)

$ journalctl -u app -n 3
Mar 04 14:01:07 web01 server[9911]: loading /srv/app/config.yaml
Mar 04 14:01:07 web01 server[9911]: error: cannot write
                    /srv/app/run/app.pid: No space left on device
Mar 04 14:01:07 web01 systemd[1]: app.service: Failed with 'exit-code'

$ df -h /srv
Filesystem  Size  Used Avail Use% Mounted on
/dev/sdb1    20G   12G  8.0G  60% /srv

$ df -i /srv
Filesystem   Inodes  IUsed IFree IUse% Mounted on
/dev/sdb1   1310720 1310720    0  100% /srv
```

## What kind of full {prediction}

In case 1, `df -h` shows 8 GB free on `/srv`, and the application reports "No space left on device".

:::question inode-full
How can both be true?
- [ ] The application's message is wrong :: It is reporting what the kernel told it.
- [x] The filesystem has no inodes left, so no new file can be created although bytes are free :: `df -i` shows 100% of inodes used. Every file needs one. Something has created over a million small files.
- [ ] The free space is reserved for root :: A small share is reserved, and that is not what is shown here. The inode count is the limit that was reached.
:::

## Case 1: one possible answer {walkthrough}

**Reading the evidence**

- nginx is running. A 502 comes from nginx itself, and means it could not get an answer from the application behind it.
- The application is in a restart loop: it starts, exits with status 1, and systemd starts it again.
- Its log gives the reason: it cannot create its PID file, "No space left on device".
- The disk has 8 GB free, and `df -i` shows that every inode is in use. The filesystem cannot hold one more file.

**Find the files**

```bash example case1-find readonly
# count entries per directory, largest last
sudo du --inodes -x /srv | sort -n | tail -n 5

#  1250114  /srv/app/tmp/sessions
```

More than a million session files, each tiny, in one directory.

**Fix**

1. Free inodes, carefully. Preview, then delete files older than a day:
   `sudo find /srv/app/tmp/sessions -type f -mtime +1 -print | head`, and then the same with `-delete`. A plain `rm *` there fails with "Argument list too long", since the shell cannot pass a million names to one command. `find` does not have that limit.
2. Check with `df -i /srv`. The application should start at its next restart attempt. Confirm with `systemctl status app` and a request with `curl`.

**Stop it from returning**

- Why are session files never removed? Add a cleanup: a timer that deletes old ones, or a session store that expires entries itself.
- Alert on inode use as well as on disk space.

**What was not the problem.** nginx, the network and the application's code. Restarting nginx, the usual first reflex for a 502, would have changed nothing.

## Case 2: cannot log in {independent}

A developer reports that they cannot SSH to `app02` since this morning. Others can. Yesterday they "tidied up some permissions" in their home directory on that server. They send this from their laptop, and an administrator sends the rest from the server.

```text example case2 readonly
laptop$ ssh -v dana@app02
debug1: Offering public key: /home/dana/.ssh/id_ed25519
debug1: Authentications that can continue: publickey
dana@app02: Permission denied (publickey).

app02$ sudo journalctl -u ssh -n 2
Authentication refused: bad ownership or modes for directory /home/dana

app02$ ls -ld /home/dana /home/dana/.ssh /home/dana/.ssh/authorized_keys
drwxrwxrwx  dana dana  /home/dana
drwx------  dana dana  /home/dana/.ssh
-rw-------  dana dana  /home/dana/.ssh/authorized_keys
```

Explain why the login fails, although the key is correct and `authorized_keys` has the right permissions. Write the fix. Say what the developer probably ran yesterday.

## Case 2: one possible answer {walkthrough}

**Why it fails.** The client offers the right key. The server refuses to use `authorized_keys`, and its log says why: "bad ownership or modes for directory /home/dana".

The home directory is `drwxrwxrwx`, which is mode 777. Anyone on the machine can write to it. That means anyone could rename `.ssh` and put their own in its place, with their own key in it, and log in as dana. The SSH server checks for this and refuses to trust key files below a directory that others can write to. It protects the account by locking it.

The files inside are correct, which is why looking only at `.ssh` finds nothing wrong. Permissions matter along the whole path.

**Fix**, run by the administrator or through a console:

```bash example case2-fix readonly
sudo chmod 755 /home/dana       # or 750, or 700
```

Then the developer connects again.

**What was probably run.** Something like `chmod -R 777 ~` or `chmod 777 ~`, to make a "Permission denied" go away. It is the standard wrong fix from the permissions module, and here it broke something that had worked.

**Two lessons**

- The server's log named the cause exactly. The client only ever says "Permission denied". When SSH refuses a key, read the server side.
- A more permissive mode is not always more permissive in effect. Some programs refuse to run with files that are too open: SSH with keys, and many programs with files that hold secrets.

## Review: a maintenance script {independent}

A team runs this from cron every night as root. Last week it deleted the application's uploads. List every fault you can find, and say which one caused the loss.

```bash example cleanup-script readonly
#!/bin/sh
# clean old temp files and compress logs

TMP_DIR=`cat /etc/app/tmpdir`
cd $TMP_DIR
find . -mtime +7 | xargs rm -rf

cd /var/log/app
gzip *.log
echo "cleanup done" | mail -s cleanup ops@example.com
```

On the night of the loss, the directory named in `/etc/app/tmpdir` no longer existed. It had been removed during a configuration change, and the file still named it. The cron entry starts the script from `/srv/app`.

## The step that did the damage {prediction}

Before you read the full list, decide from the description above.

:::question cleanup-cause
Which sequence deleted the uploads?
- [ ] `gzip *.log` compressed files the application needed :: That step runs in `/var/log/app` and touches only logs.
- [x] `cd` failed because the directory was gone, the script carried on, and `find . -mtime +7 | xargs rm -rf` ran in `/srv/app` :: With no `set -e` the script continued after the failed `cd`. `find .` then searched the directory the script had started in, and everything older than 7 days there was removed.
- [ ] The `mail` command failed :: A failed notification deletes nothing.
:::

## Review: what is wrong {walkthrough}

**The chain that caused the loss**

1. `TMP_DIR` held the path of a directory that had been removed.
2. `cd $TMP_DIR` failed with "No such file or directory", and the script stayed where it had started, in `/srv/app`.
3. There is no `set -e`, so the script went on to the next line.
4. `find . -mtime +7 | xargs rm -rf` deleted everything older than a week under the current directory. In `/srv/app`, that included the uploads.

**All the faults**

- No `set -euo pipefail`, so no failure stops it. With it, the failed `cd` would have ended the script.
- An empty `TMP_DIR` would be as bad: an unquoted empty value turns `cd $TMP_DIR` into plain `cd`, which goes to root's home directory.
- No check that `TMP_DIR` is set, is a directory, and is the directory expected.
- Unquoted variables.
- `find .` with a relative start. The search depends on a `cd` that may have failed.
- `find | xargs rm` breaks on names with spaces, and `-rf` hides every problem.
- No `-type f`. Whole directories older than 7 days are removed, with newer files inside them.
- `#!/bin/sh` with no assurance of which shell that is.
- It runs as root, so nothing limited what it could delete.
- `gzip *.log` compresses the log the application is writing to at that moment.
- The email says "cleanup done" whatever happened.
- Backticks work, and `$(...)` is the clearer modern form.

**Rewritten**

```bash example cleanup-fixed readonly
#!/usr/bin/env bash
set -euo pipefail

tmp_dir="/srv/app/tmp"

if [ ! -d "$tmp_dir" ]; then
  echo "cleanup: $tmp_dir is not a directory" >&2
  exit 1
fi

find "$tmp_dir" -xdev -type f -mtime +7 -delete

find /var/log/app -name "*.log.*" ! -name "*.gz" -mtime +1 \
  -exec gzip {} +

echo "cleanup ok"
```

**What changed**

- The directory is a fixed absolute path, checked before use, and given to `find` directly. Nothing depends on the working directory.
- `-type f` and `-delete` remove files only, and handle any file name.
- Only rotated logs older than a day are compressed, and the live log is left alone.
- It should run as the application's user, not as root, so that a future mistake is limited by permissions.
- It exits non-zero on any failure, and the scheduler should alert on that.

## Where to go next {explanation}

You can now move around a Linux system, read and search its files, join commands into pipelines, control permissions and processes, write a careful script, manage services, and work out why a machine is misbehaving.

Four habits are worth keeping.

- **Read the error message, and the log behind it.** They nearly always say what is wrong.
- **Look before you change.** Preview a pattern with `ls`, a `find` with `-print`, a `sed` without `-i`.
- **Quote your variables, and start scripts with `set -euo pipefail`.**
- **Grant the least that works.** A specific owner or group, never 777, and `sudo` only when needed.

The manual pages are the reference for everything in this course. When a command surprises you, `man` and `--help` are faster and more accurate than memory.

The Docker and CI/CD courses build directly on this one. A container is a Linux process with its own view of the filesystem and network, and a pipeline is a series of shell commands that must each exit with zero.
