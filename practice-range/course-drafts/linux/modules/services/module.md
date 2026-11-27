---
id: course:linux/module/services
title: Services and logs
requires: []
outcomes: []
tasks: []
drills: []
---

A server's real work is done by programs that run all the time without anyone logged in. This module covers how those services are started, stopped and kept alive, and where to read what they say when something goes wrong.

## What a service is

A **service** (also called a daemon) is a program that runs in the background for as long as the machine is up: a web server, a database, the SSH server.

A service needs things that a program started from a terminal does not get.

- It starts when the machine boots, with nobody logged in.
- It is restarted if it crashes.
- It runs as its own user, with limited rights.
- Its output is collected somewhere.
- It starts after the things it needs, such as the network.

A **service manager** provides these. On almost every current distribution it is **systemd**, which is also the first process, PID 1. You talk to it with the command `systemctl`.

## Controlling a service

```bash example systemctl readonly
systemctl status nginx            # is it running, and what did it say last
sudo systemctl start nginx        # start it now
sudo systemctl stop nginx         # stop it now
sudo systemctl restart nginx      # stop, then start
sudo systemctl reload nginx       # re-read configuration, keep running
sudo systemctl enable nginx       # start it at every boot
sudo systemctl disable nginx      # do not start it at boot
sudo systemctl enable --now nginx # enable, and start right away
```

Two pairs are easy to confuse.

**Start and enable are separate.** `start` runs the service now. `enable` arranges for it to start at boot. A service that was started and not enabled is gone after the next reboot. A service that was enabled and not started is not running yet.

**Restart and reload are separate.** `restart` stops the process and starts a new one, which drops the connections in progress. `reload` asks the running process to read its configuration again without stopping. Use `reload` where the service supports it.

## Reading the status

`systemctl status` is the first command to run when a service misbehaves. It shows the state and the last few log lines together.

```text example status readonly
* nginx.service - A high performance web server
     Loaded: loaded (/lib/systemd/system/nginx.service; enabled)
     Active: active (running) since Tue 2025-03-04 09:14:02 UTC; 5h ago
   Main PID: 903 (nginx)
      Tasks: 3
     Memory: 12.4M
     CGroup: /system.slice/nginx.service
             |-903 nginx: master process /usr/sbin/nginx
             |-904 nginx: worker process
             `-905 nginx: worker process

Mar 04 09:14:02 web01 systemd[1]: Started A high performance web server.
```

Read three things.

- **Loaded:** where the definition file is, and whether the service is `enabled` for boot.
- **Active:** the state now, and since when. `active (running)` is healthy. `failed` means it exited with an error. `activating (auto-restart)` that keeps recurring means it is crashing and being restarted in a loop.
- **The log lines at the bottom**, which usually say why.

A service that started seconds ago, when you expected it to have been up for days, has been restarting.

## Unit files

systemd describes each thing it manages in a **unit file**. A service's unit file says what to run and how.

```text example unit readonly
[Unit]
Description=Orders API
After=network-online.target
Wants=network-online.target

[Service]
User=orders
Group=orders
WorkingDirectory=/srv/orders
EnvironmentFile=/etc/orders/env
ExecStart=/srv/orders/bin/server --port 8080
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

| Line | Meaning |
| --- | --- |
| `After=` | Start this after the named unit |
| `User=` | Run as this user, not as root |
| `EnvironmentFile=` | Read environment variables from this file |
| `ExecStart=` | The command to run. Give the program's full path |
| `Restart=on-failure` | Start it again if it exits with an error |
| `WantedBy=multi-user.target` | What `enable` attaches it to: normal boot |

Unit files supplied by packages live in `/lib/systemd/system`. Your own, and your changes, go in `/etc/systemd/system`, which takes priority. After changing any unit file, tell systemd to read them again.

```bash example daemon-reload readonly
sudo systemctl daemon-reload         # re-read unit files after an edit
sudo systemctl restart orders        # then restart the service
systemctl cat orders                 # show the unit file in effect
sudo systemctl edit orders           # add an override, the safe way
```

`systemctl edit` creates a small override file and leaves the packaged file alone, so that a package update does not undo your change.

## Gone after the reboot {prediction}

An engineer installs a new service, writes its unit file, runs `sudo systemctl start orders`, checks that it works and goes home. That night the server is rebooted for a kernel update.

:::question enable
What is the state of the service in the morning?
- [ ] Running, since it was started :: `start` affects only the current boot.
- [x] Not running, since it was never enabled :: Starting a service and enabling it at boot are separate steps. `sudo systemctl enable --now orders` does both.
- [ ] Failed, since the kernel changed :: A kernel update does not break a service like this. It simply was not started.
:::

## Why a service differs from your terminal

"It works when I run it by hand and fails as a service" is a common report. A service runs in a different setting.

| | In your terminal | As a service |
| --- | --- | --- |
| User | You | The `User=` in the unit, often with fewer rights |
| Environment | Your dotfiles, your `PATH` | Only what the unit sets |
| Working directory | Where you happen to be | `WorkingDirectory=`, or `/` |
| Input | Your keyboard | None |
| Output | The screen | The journal |

So check, in order: can that user read the files and write where it needs to? Does the program rely on a variable or a `PATH` entry from your shell? Does it use a relative path that assumes a directory?

## The journal

systemd collects the output of every service, along with system messages, in the **journal**. `journalctl` reads it.

```bash example journalctl readonly
journalctl -u nginx                  # everything from one service
journalctl -u nginx -n 50            # the last 50 lines
journalctl -u nginx -f               # follow, like tail -f
journalctl -u nginx --since "1 hour ago"
journalctl -u nginx --since "2025-03-04 14:00" --until "14:30"
journalctl -u orders -p err          # errors and worse only
journalctl -b                        # everything since this boot
journalctl -b -1                     # the previous boot
journalctl -k                        # kernel messages
journalctl -xe                       # the most recent entries, explained
```

Whatever a service prints to standard output or standard error lands here, with a timestamp and the service's name. A program does not need to manage a log file of its own. It can simply print.

`-u` selects a unit, and nearly every investigation starts with it. Add `--since` to narrow the time, since a busy service produces a great deal.

## Log files

Not everything uses the journal. Many programs write their own files, by convention under `/var/log`.

| File or directory | Holds |
| --- | --- |
| `/var/log/syslog` or `/var/log/messages` | General system messages |
| `/var/log/auth.log` or `/var/log/secure` | Logins, `sudo` use, SSH attempts |
| `/var/log/nginx/` | The web server's access and error logs |
| `/var/log/apt/` or `/var/log/dnf.log` | What was installed and when |
| `/var/log/kern.log` | Kernel messages |

The names differ between distribution families. `ls -lt /var/log | head` shows which files changed most recently, which is a quick way to find the one that matters.

## Rotation

A log that grows for ever fills the disk. **Log rotation** prevents it. On a schedule, the current file is renamed, a new empty one is started, old ones are compressed, and the oldest are deleted.

```text example rotate readonly
   app.log          today, being written
   app.log.1        yesterday
   app.log.2.gz     two days ago, compressed
   app.log.3.gz
   ...
   app.log.14.gz    the oldest kept. Older ones are deleted
```

The tool is `logrotate`, configured by files in `/etc/logrotate.d`. The journal limits its own size separately.

Two consequences come up in practice. Searching for something from last week means searching the rotated files too, with `zgrep` for the compressed ones. And an application that writes its own log file with no rotation rule is a full disk waiting to happen.

## When a service will not start

Work through the same steps each time.

1. `systemctl status <name>`. Read the state and the last lines.
2. `journalctl -u <name> -n 100`. Read upward from the end to the first error.
3. Run the `ExecStart` command by hand as the service's user: `sudo -u orders /srv/orders/bin/server --port 8080`. The error then prints straight to your terminal.
4. Check what it needs: the configuration file, the port, the permissions, the dependency it connects to.

The message is nearly always there. The usual ones are:

| Message | Cause |
| --- | --- |
| `Address already in use` | Another process holds the port |
| `Permission denied` | The service's user cannot read or write something |
| `No such file or directory` | A wrong path, often a relative one |
| `status=203/EXEC` | systemd could not run the program: wrong path, or not executable |
| `Start request repeated too quickly` | It crashed repeatedly, and systemd gave up |

For the last one, the cause is in the earlier lines. After fixing it, `sudo systemctl reset-failed <name>` clears the state.

## Timers

systemd can also run something on a schedule, as cron does. A **timer** unit starts a service unit at set times. Its advantages over cron are that the output goes to the journal like any other service, and that a run missed while the machine was off can be caught up.

```bash example timers readonly
systemctl list-timers               # every timer and its next run
journalctl -u backup.service        # the output of past runs
```

## The crash loop {prediction}

`systemctl status orders` shows `Active: activating (auto-restart)`, and the start time changes every few seconds. The last journal line reads `Error: cannot open /etc/orders/env: Permission denied`.

:::question crash-loop
What is happening, and what should be checked?
- [ ] The service is healthy and reloading its configuration :: A reload does not restart the process. This one is exiting and being started again.
- [x] The service exits at start because its user cannot read that file, and systemd keeps restarting it :: `Restart=on-failure` restarts it each time. Check the owner and mode of `/etc/orders/env` against the `User=` in the unit, and of the directory that holds it.
- [ ] systemd is broken and must be restarted :: systemd is doing what the unit asked. The program is the part that fails.
:::

## Exercise: bring the service up {independent}

A colleague wrote this unit file for a small API and reports that it "does not work". The API listens on port 80 and reads `config.yaml` from its own directory.

```text example bad-unit readonly
[Unit]
Description=Reports API

[Service]
ExecStart=server --config config.yaml

[Install]
WantedBy=multi-user.target
```

They ran `sudo systemctl start reports`, and `systemctl status reports` shows `failed` with `status=203/EXEC`. They also mention that, when it did run once in their terminal, it ran as root.

List the problems with the unit file. Write a corrected one, and the commands to put it into effect and check it.

## One possible answer {walkthrough}

**Problems**

1. **`ExecStart` has no full path.** systemd does not use your shell's `PATH`, and the program is not in the few system directories it does search. This is the `203/EXEC` error.
2. **A relative path to the configuration,** with no working directory set. A service starts in `/`, so `config.yaml` is not found.
3. **No user.** It runs as root, so a flaw in the API is a flaw with full control of the machine.
4. **Port 80 needs a privilege.** Ports below 1024 cannot be opened by an ordinary user. Listen on a high port behind a proxy, or grant only that one capability.
5. **No restart policy.** A crash leaves it down.
6. **No ordering.** It may start before the network is ready.

**Corrected**

```text example good-unit readonly
[Unit]
Description=Reports API
After=network-online.target
Wants=network-online.target

[Service]
User=reports
Group=reports
WorkingDirectory=/srv/reports
ExecStart=/srv/reports/bin/server --config /srv/reports/config.yaml
AmbientCapabilities=CAP_NET_BIND_SERVICE
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**Put it into effect**

```bash example unit-commands readonly
sudo useradd --system --no-create-home reports
sudo chown -R reports:reports /srv/reports
sudo systemctl daemon-reload
sudo systemctl enable --now reports
systemctl status reports
journalctl -u reports -n 50
```

`AmbientCapabilities` lets the unprivileged user open port 80 and nothing else. `daemon-reload` is needed because the unit file changed. `enable --now` starts the service and makes it survive a reboot. The last two commands check the result, which is the step most often skipped.
