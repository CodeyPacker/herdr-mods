---
id: course:linux/module/ssh
title: Remote access with SSH
requires: []
outcomes: []
tasks: []
drills: []
---

SSH is how you get a shell on a machine that is somewhere else. This module covers how it identifies the server and you, how to use keys in place of passwords, and how to make daily use of it short and safe.

The security advice here is general guidance, not any organization's policy.

## What SSH gives you

**SSH** (secure shell) opens an encrypted connection to another machine and runs a shell there. Everything you type and everything the machine answers is encrypted on the way.

```bash example connect readonly
ssh ana@web01.example.com            # log in as ana
ssh ana@10.0.1.5                     # by address
ssh -p 2222 ana@web01.example.com    # a port other than 22
ssh ana@web01 'df -h /'              # run one command and return
exit                                 # leave the remote shell
```

The form is `ssh user@host`. Without `user@`, your local user name is used. With a command on the end, SSH runs that command on the remote machine and returns, without an interactive shell. That makes it usable in scripts.

Watch your prompt. It names the machine you are on. Running a command on the wrong machine is an easy and sometimes costly mistake.

## Knowing the server

The first time you connect to a machine, SSH shows a **host key fingerprint** and asks whether to continue.

```text example first-connect readonly
The authenticity of host 'web01.example.com (203.0.113.10)' can't be
established.
ED25519 key fingerprint is SHA256:k3Xp9aTq8wm1ZrV7exampleexampleexampl.
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```

Every server has its own key pair. The fingerprint identifies it. When you answer yes, the key is saved in `~/.ssh/known_hosts`. On every later connection, SSH checks that the server presents the same key and says nothing if it does.

If the key has changed, SSH refuses to connect and prints a large warning. There are two possible reasons. The server was rebuilt or replaced, which is common and harmless. Or something is pretending to be the server, in order to capture what you send.

Do not delete the old entry by reflex. Find out why the key changed. If the server was rebuilt, remove the old key with `ssh-keygen -R hostname` and connect again.

Strictly, the fingerprint at first connection should be compared with one obtained through another channel, such as the cloud console. Few people do. It is the one moment at which SSH cannot protect you by itself.

## Passwords and keys

SSH can identify you by a password or by a **key pair**. Keys are better in every way that matters.

A key pair has two parts.

- The **private key** stays on your machine and is never shared or copied to a server.
- The **public key** is placed on each server you want to reach. It is safe to hand to anyone.

At login, the server sends a challenge, your client answers using the private key, and the server checks the answer against the public key. The private key never leaves your machine. A server that is compromised learns nothing it could use to log in elsewhere as you.

| | Password | Key |
| --- | --- | --- |
| Can be guessed | Yes, and automated guessing is constant | No, not in practice |
| Sent to the server | Yes | No |
| Reused across servers | The same secret everywhere | One public key, safe to place anywhere |
| Works in scripts | Poorly | Yes |

Servers that face the internet receive password guesses all day. Turning password login off, and allowing only keys, ends that whole class of attack.

```text example keypair readonly
   your machine                          the server

   ~/.ssh/id_ed25519       private       ~/.ssh/authorized_keys
   (never leaves here)                   (holds your PUBLIC key)

   ~/.ssh/id_ed25519.pub   public  ----> copied here once

   login: the server sends a challenge, your client answers with
   the private key, and the server checks it with the public key.
```

## Creating and installing a key

```bash example keygen readonly
ssh-keygen -t ed25519 -C "ana@laptop"      # create a key pair
# press Enter for the default file, then choose a passphrase

ls ~/.ssh
# id_ed25519        the private key. Keep it secret
# id_ed25519.pub    the public key. Safe to share

ssh-copy-id ana@web01.example.com          # install the public key
ssh ana@web01.example.com                  # now logs in with the key
```

`ed25519` is the current recommended key type. `ssh-copy-id` adds your public key to `~/.ssh/authorized_keys` on the server, which is the list of keys allowed to log in as that user.

Set a **passphrase** when asked. It encrypts the private key file. Without one, anyone who copies that file from your laptop or a backup can log in as you. With one, the file alone is useless.

SSH insists on strict permissions and silently ignores files that are too open.

```bash example ssh-perms readonly
chmod 700 ~/.ssh
chmod 600 ~/.ssh/id_ed25519
chmod 644 ~/.ssh/id_ed25519.pub
chmod 600 ~/.ssh/authorized_keys
```

## Which file goes where {prediction}

A new engineer needs access to a server. They create a key pair and send both files, `id_ed25519` and `id_ed25519.pub`, to the administrator by chat, "so it can be set up".

:::question which-key
What should have been sent?
- [ ] Both files, as they did :: The private key has now been copied to a chat system and to another person. It can no longer be considered private.
- [x] Only `id_ed25519.pub`, the public key :: The administrator adds the public key to `authorized_keys`. The private key must never leave its owner's machine. This pair should now be discarded and a new one made.
- [ ] Only `id_ed25519`, the private key :: That is the one file that must never be shared.
:::

## The agent

Typing a passphrase at every connection is tedious, and the tedium tempts people to leave it empty. The **SSH agent** solves that. It is a small program that holds your unlocked keys in memory for the session.

```bash example agent readonly
eval "$(ssh-agent -s)"          # start an agent, if none is running
ssh-add ~/.ssh/id_ed25519       # unlock the key once, with the passphrase
ssh-add -l                      # list the keys the agent holds
```

After that, connections use the key without asking. Most desktop systems start an agent for you and tie it to your login.

**Agent forwarding** (`ssh -A`) lets a server you are logged in to use the agent on your laptop, so that you can connect onward from it. Be careful with it. While you are connected, anyone with root on that server can use your agent to log in elsewhere as you. Forward only to machines you fully trust. For reaching a machine through another, the jump host option below is safer.

## The config file

`~/.ssh/config` stores settings per host, so that long commands become short names.

```text example ssh-config readonly
Host web01
    HostName web01.example.com
    User ana
    IdentityFile ~/.ssh/id_ed25519

Host db01
    HostName 10.0.2.8
    User ana
    ProxyJump bastion

Host bastion
    HostName bastion.example.com
    User ana
    Port 2222

Host *
    ServerAliveInterval 60
```

With this file, `ssh web01` is enough. The settings also apply to `scp`, `rsync` and anything else that runs over SSH.

`ServerAliveInterval 60` sends a small message every minute, which stops idle connections from being cut by firewalls on the way.

## Jump hosts

Servers in a private network are often reachable only through one hardened machine, called a **bastion** or jump host. `ProxyJump` connects through it in one step.

```bash example jump readonly
ssh -J ana@bastion.example.com ana@10.0.2.8     # on the command line
ssh db01                                        # with the config above
```

Your connection to the inner machine is encrypted end to end, through the bastion. Your key is used from your laptop and is never placed on the bastion.

```text example bastion readonly
   laptop ========> bastion ========> db01 (10.0.2.8)
                    public            private network,
                    address           no public address

   One command. The inner connection passes through the bastion,
   and your private key stays on the laptop.
```

## Tunnels

SSH can also carry other connections inside its own. This is **port forwarding**.

```bash example tunnel readonly
# local forward: my port 5433 leads to port 5432 as seen from web01
ssh -L 5433:10.0.2.8:5432 ana@web01

# then, on my laptop, in another terminal:
psql -h localhost -p 5433
```

The database accepts connections only from inside the private network. The tunnel lets a tool on your laptop reach it, through a server that can.

A tunnel lasts as long as the SSH session, and it bypasses whatever network rules would otherwise apply. Use it for short tasks, close it afterwards, and follow your organization's rules about reaching production data.

## Securing the server side

The SSH server's settings are in `/etc/ssh/sshd_config`. A few lines matter most.

```text example sshd-config readonly
PasswordAuthentication no        # keys only
PermitRootLogin no               # log in as yourself, then use sudo
PubkeyAuthentication yes
AllowUsers ana bilal deploy      # only these accounts may log in
```

- **Keys only** ends password guessing.
- **No root login** means every session belongs to a named person, and their use of `sudo` is logged.
- **Limit who can reach port 22**, with a firewall, to a bastion or a VPN where possible.
- **Remove keys when people leave.** A line in `authorized_keys` works until someone deletes it.

Before reloading the SSH server after a change, keep your current session open and test a new login from a second terminal. A mistake in this file can lock everyone out, and an open session is your way back in.

```bash example sshd-test readonly
sudo sshd -t                         # check the file for errors
sudo systemctl reload ssh            # apply. The unit may be named sshd
# in a SECOND terminal, before closing the first:
ssh ana@web01
```

## When it will not connect

`ssh -v` prints each step of the connection: resolving the name, connecting, checking the host key, offering each key, and the server's answer.

| Message | Cause |
| --- | --- |
| `Connection timed out` | A firewall, a wrong address, or the machine is down |
| `Connection refused` | Nothing listens on that port |
| `Permission denied (publickey)` | The server accepted none of your keys |
| `Host key verification failed` | The server's key differs from the saved one |
| `Too many authentication failures` | The agent offered several wrong keys first |
| `UNPROTECTED PRIVATE KEY FILE` | The key file's permissions are too open |

For "permission denied", check in order: that you are using the right user name, that the right key is being offered (shown by `-v`), that the public key is in `authorized_keys` on the server, and that the permissions of the home directory, `.ssh` and `authorized_keys` on the server are strict. The server's own log, in `/var/log/auth.log` or the journal, states the reason exactly.

## The changed key {prediction}

An engineer connects to `web01` as they do every day, and SSH prints "WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED" and refuses. A colleague suggests deleting `~/.ssh/known_hosts`.

:::question host-key-changed
What is the right response?
- [ ] Delete `known_hosts` and reconnect :: That discards the saved keys of every server, and accepts whatever answers now without a check.
- [x] Find out why the key changed before accepting the new one :: If `web01` was rebuilt today, the change is expected. Remove that one entry with `ssh-keygen -R web01` and reconnect. If nobody rebuilt it, something else is answering at that address, and it should be reported.
- [ ] Add `-o StrictHostKeyChecking=no` to the command :: That turns off the check that just did its job.
:::

## Exercise: set up access {independent}

You join a team and need access to three machines: a bastion at `bastion.example.com` on port 2222, and two private servers, `app01` (`10.0.1.21`) and `db01` (`10.0.2.8`), reachable only through the bastion. Your user name on all three is `ana`.

Write the steps to create your key and get it installed, the `~/.ssh/config` that lets you type `ssh app01` and `ssh db01`, and a command that copies a local file `dump.sql` to `/tmp` on `db01`. Then name three things you would not do.

## One possible answer {walkthrough}

**Key**

```bash example setup-key readonly
ssh-keygen -t ed25519 -C "ana@work-laptop"     # with a passphrase
ssh-add ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub                      # send THIS to the admin
```

The administrator adds that one line to `~/.ssh/authorized_keys` for `ana` on each machine.

**Config**

```text example setup-config readonly
Host bastion
    HostName bastion.example.com
    User ana
    Port 2222

Host app01
    HostName 10.0.1.21
    User ana
    ProxyJump bastion

Host db01
    HostName 10.0.2.8
    User ana
    ProxyJump bastion

Host *
    IdentityFile ~/.ssh/id_ed25519
    ServerAliveInterval 60
```

**Copy the file**

```bash example setup-copy readonly
scp dump.sql db01:/tmp/
```

`scp` reads the same config, so the jump through the bastion happens by itself.

**Three things not to do**

1. **Send the private key to anyone, or copy it onto the bastion.** `ProxyJump` exists so that the key never leaves the laptop.
2. **Create the key without a passphrase.** A laptop backup or a stolen file would then be a working login.
3. **Use agent forwarding to hop from the bastion.** The bastion is shared, and anyone with root there could use the forwarded agent. `ProxyJump` does the same job without that exposure.

A fourth, for later: when you leave the team, your line should be removed from `authorized_keys` on all three machines.
