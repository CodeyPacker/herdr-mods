---
id: course:linux/module/network
title: Network tools
requires: []
outcomes: []
tasks: []
drills: []
---

Sooner or later a server cannot reach something, or cannot be reached. This module covers the commands that show a machine's network setup and test each step of a connection. The Networking course explains the ideas behind them. This one is about the tools.

## The machine's own setup

Start by looking at what the machine has: its addresses, its routes and its name servers.

```bash example ip readonly
ip addr                 # interfaces and their addresses (short: ip a)
ip route                # the route table (short: ip r)
cat /etc/resolv.conf    # which DNS servers are used
hostname                # this machine's name
hostname -I             # its addresses, on one line
```

```text example ip-output readonly
1: lo: <LOOPBACK,UP,LOWER_UP>
    inet 127.0.0.1/8 scope host lo
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP>
    inet 10.0.1.5/24 brd 10.0.1.255 scope global eth0

default via 10.0.1.1 dev eth0
10.0.1.0/24 dev eth0 proto kernel scope link src 10.0.1.5
```

Read it like this. `lo` is the loopback interface, which every machine has. `eth0` has the address `10.0.1.5` in a `/24` subnet. `UP` means the interface is enabled. The `default via` line names the gateway used for everything outside the subnet.

No address on the interface, or no `default` line, explains a machine that can reach nothing. Older guides use `ifconfig` and `route` for the same information. The `ip` command replaced them.

## What is listening

A service that should accept connections has to be listening on a port. `ss` shows which ports are open and which process holds each.

```bash example ss readonly
sudo ss -ltnp           # listening TCP sockets, with the process
sudo ss -lunp           # the same for UDP
ss -tn                  # established TCP connections
```

```text example ss-output readonly
State  Recv-Q Send-Q Local Address:Port Peer Address:Port Process
LISTEN 0      128          0.0.0.0:22        0.0.0.0:*
       users:(("sshd",pid=812,fd=3))
LISTEN 0      244        127.0.0.1:5432      0.0.0.0:*
       users:(("postgres",pid=1120,fd=6))
LISTEN 0      511          0.0.0.0:80        0.0.0.0:*
       users:(("nginx",pid=903,fd=5))
LISTEN 0      511             [::]:80           [::]:*
       users:(("nginx",pid=903,fd=6))
```

Read the `Local Address:Port` column and the process at the end. On a real terminal each entry is one long line. It is wrapped here to fit.

The address in front of the port decides who can connect. `127.0.0.1:5432` accepts connections from this machine only. `0.0.0.0:80` accepts them on every interface. `[::]` is the same for IPv6.

The options are worth knowing: `-l` listening, `-t` TCP, `-u` UDP, `-n` numbers and not names, `-p` the process. `sudo` is needed to see processes that belong to other users. Older guides use `netstat` with similar options.

## Names

`dig` asks DNS a question and shows the full answer. `getent hosts` resolves a name the way programs on this machine do, which includes the local file `/etc/hosts`.

```bash example dns readonly
dig +short api.example.com          # just the address
dig api.example.com                 # the full answer, with TTL
dig @10.0.0.2 api.example.com       # ask one specific server
getent hosts api.example.com        # as an application would resolve it
cat /etc/hosts                      # local names that override DNS
```

The difference between the last two and `dig` matters. `/etc/hosts` is checked before DNS. A stale line there makes one machine resolve a name differently from every other, and `dig` will not show it, since `dig` talks only to DNS. When a name behaves oddly on a single machine, read `/etc/hosts`.

## Can I reach it

Test reachability in steps, each a little higher than the one before.

```bash example reach readonly
ping -c 4 10.0.1.1                  # does the gateway answer
ping -c 4 api.example.com           # does a name resolve and answer
nc -vz -w 3 10.0.2.8 5432           # does a TCP port accept a connection
traceroute api.example.com          # which hops are on the path
```

`ping` sends a small test packet and reports whether a reply came, and how long it took. `-c 4` sends four and stops. On Linux, without it, `ping` runs until you press Ctrl+C.

The `-w 3` makes `nc` give up after 3 seconds. Without it, a blocked connection can hang for minutes.

A failed `ping` proves little, since many networks block those packets while allowing real traffic. A successful TCP connection with `nc -vz` proves much more: the path works and something is listening.

`nc` gives three different results, and each has a meaning.

| Result | Meaning |
| --- | --- |
| `succeeded` or `open` | The path and the port are fine |
| `Connection refused`, at once | The machine answered, and nothing listens on that port |
| `timed out`, after a wait | A firewall dropped it, or the address is unreachable |

## HTTP with curl

`curl` makes a request and prints the response. It is the main tool for testing anything that speaks HTTP.

```bash example curl readonly
curl https://api.example.com/health          # print the body
curl -i https://api.example.com/health       # include response headers
curl -I https://api.example.com/health       # headers only
curl -v https://api.example.com/health       # show the whole exchange
curl -s -o /dev/null -w "%{http_code}\n" https://api.example.com/health
curl -L http://example.com                   # follow redirects
curl -X POST https://api.example.com/orders \
  -H "Content-Type: application/json" \
  -d '{"item": "kettle"}'
curl --max-time 5 https://api.example.com/   # give up after 5 seconds
```

`-v` is the one to remember. It shows the address the name resolved to, the connection, the TLS handshake and certificate, the request sent and the response received. Wherever the output stops is where the problem is.

The fifth line prints only the status code, which is useful in scripts. In a script, also add `--fail`, so that an HTTP error status gives a non-zero exit status, and `--max-time`, so that a hung server cannot hang the script.

## Refused or timed out {prediction}

From an application server, `nc -vz 10.0.2.8 5432` prints `Connection refused` immediately. On the database server `10.0.2.8`, `ss -ltnp` shows `LISTEN 127.0.0.1:5432`.

:::question listen-local
What is the cause?
- [ ] A firewall between the two servers :: A firewall that drops packets causes a timeout. The refusal came back at once, so the database server itself answered.
- [x] The database listens only on the loopback address, so connections from other machines are refused :: Nothing listens on port 5432 at the server's network address. The database's listen address needs to include that interface.
- [ ] The database is not running :: `ss` shows it listening. It is listening in the wrong place for this purpose.
:::

## The local firewall

A machine can filter its own traffic. Several tools manage the same underlying kernel feature, and which one is in use depends on the distribution.

```bash example firewall readonly
sudo ufw status verbose              # Ubuntu's simple front end
sudo firewall-cmd --list-all         # Red Hat family
sudo nft list ruleset                # the rules underneath
sudo iptables -L -n -v               # the older tool, still common
```

When a service is listening on the right address and remote clients still time out, the local firewall is the next thing to check, followed by the firewall rules of the network or cloud platform outside the machine.

## Copying files between machines

```bash example transfer readonly
scp report.pdf ana@web01:/tmp/                 # copy a file to a server
scp ana@web01:/var/log/app.log ./              # copy one back
scp -r ./site ana@web01:/srv/                  # a whole directory

rsync -av ./site/ ana@web01:/srv/site/         # copy only what changed
rsync -av --delete ./site/ ana@web01:/srv/site/     # and remove extras
rsync -avn ./site/ ana@web01:/srv/site/        # -n: show, do nothing
```

Both run over SSH. `scp` copies everything each time. `rsync` compares the two sides and sends only the differences, so it is much faster for repeated copies and can resume after an interruption.

With `rsync`, a trailing slash on the source changes the meaning. `site/` copies the contents of the directory. `site` copies the directory itself, creating `site` inside the destination. `--delete` removes files at the destination that are not in the source, so run it with `-n` first and read what it would do.

## Downloading

```bash example download readonly
curl -fLO https://example.com/files/tool.tar.gz     # save under its name
wget https://example.com/files/tool.tar.gz          # the same, with wget
sha256sum tool.tar.gz                               # compute its checksum
```

`-f` makes `curl` fail on an HTTP error, so an error page is not saved as if it were the file. `-L` follows redirects and `-O` keeps the remote file name.

When a download page publishes a checksum, compute yours and compare. A match shows the file arrived complete and is the one that was published.

## A method for "it cannot connect"

Put the tools in the order a connection is made, and stop at the first step that fails.

1. **Is my own network up?** `ip addr`, `ip route`.
2. **Does the name resolve?** `dig +short name`, and `getent hosts name`.
3. **Is the port reachable?** `nc -vz address port`.
4. **Does the service answer correctly?** `curl -v`.
5. **On the server:** is it listening, and on which address? `ss -ltnp`. Is a local firewall in the way?

Run the same test from two places when you can. If it works from the server itself and fails from another machine, the fault is the listening address or a firewall. If it works by address and fails by name, the fault is DNS.

```text example ladder readonly
   5  on the server   ss -ltnp, firewall rules
   4  application     curl -v
   3  port            nc -vz address port
   2  name            dig +short, getent hosts
   1  my own network  ip addr, ip route

   Start at 1. The first step that fails is where to look.
```

## One machine disagrees {prediction}

Every server resolves `db.internal.example.com` to `10.0.2.8`. One application server keeps connecting to `10.0.2.3`, an address that was retired last month. On that server, `dig +short db.internal.example.com` prints `10.0.2.8`.

:::question etc-hosts
Where is the old address most likely coming from?
- [ ] A stale DNS cache on that server :: `dig` on that same server returns the right address from DNS.
- [x] A line in that server's `/etc/hosts` :: That file is checked before DNS, and `dig` does not read it. `getent hosts db.internal.example.com` would show the old address. Someone added the line long ago and it was never removed.
- [ ] The database's own configuration :: The database does not decide what address clients look up.
:::

## Exercise: find the fault {independent}

A new application server, `app03` at `10.0.1.30`, cannot reach the internal API at `https://api.internal.example.com`. The other application servers can. You run these on `app03`.

```text example fault-output readonly
$ ip route
10.0.1.0/24 dev eth0 proto kernel scope link src 10.0.1.30

$ dig +short api.internal.example.com
10.0.4.12

$ nc -vz 10.0.4.12 443
nc: connect to 10.0.4.12 port 443 (tcp) failed: Network is unreachable

$ nc -vz 10.0.1.9 22
Connection to 10.0.1.9 22 port [tcp/ssh] succeeded!
```

Say which steps are proven to work, what the fault is, how you would confirm it by comparing with a working server, and what the fix is. Then say what you would check next, once the fix is in.

## One possible answer {walkthrough}

**Proven to work.** The interface is up and has an address. DNS resolves the name, so the name servers are reachable. A connection to `10.0.1.9`, a machine in the same subnet, succeeds.

**The fault.** "Network is unreachable" is the machine's own kernel speaking: it has no route for that destination. The route table shows why. It has the route for the local subnet and no `default via` line. The API is at `10.0.4.12`, in another subnet, and without a default gateway `app03` has nowhere to send the packet. Machines in `10.0.1.0/24` work, since they need no gateway.

That DNS works suggests the name server is in the local subnet as well.

**Confirm.** Run `ip route` on a working application server. It will have a line such as `default via 10.0.1.1 dev eth0`.

**Fix.** Add the default route. For an immediate test: `sudo ip route add default via 10.0.1.1`. That lasts until reboot. The permanent fix belongs in the machine's network configuration, or in whatever built `app03`, since it was created without a gateway and the next server will be too.

**Next.** Move up the steps. Run `nc -vz 10.0.4.12 443` again. If it now times out, a firewall rule probably does not include the new server's address yet. Then `curl -v https://api.internal.example.com/health` to check TLS and the response.

The message decided the direction. "Unreachable" pointed at this machine's routes. "Refused" would have pointed at the API server, and a timeout at a firewall in between.
