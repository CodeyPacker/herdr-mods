---
id: course:networking/module/ports
title: Ports and sockets
requires: []
outcomes: []
tasks: []
drills: []
---

An IP address gets a packet to the right machine. A port gets it to the right program on that machine. This module covers what a port is, what "listening" means, and why a server can be running and still unreachable.

## What a port is

A machine runs many programs that use the network at once. Each one is told apart by a **port**: a number from 0 to 65535 that the transport layer adds to every packet.

An address and a port together name one endpoint, written with a colon: `203.0.113.10:443`.

Some port numbers have agreed uses, so that clients know where to look.

| Port | Usual use |
| --- | --- |
| 22 | SSH (remote terminal) |
| 53 | DNS |
| 80 | HTTP |
| 443 | HTTPS |
| 5432 | PostgreSQL |
| 6379 | Redis |

These are conventions. Nothing stops a web server from using port 8080, and development servers often do. Ports below 1024 are different in one way: on most systems a program needs administrator rights to use them.

```text example ports readonly
   one machine, address 203.0.113.10

   +----------------------------------------------+
   |  :22    SSH server                           |
   |  :443   web server                           |
   |  :5432  database                             |
   +----------------------------------------------+

   A packet to 203.0.113.10:443 goes to the web server.
   A packet to 203.0.113.10:5432 goes to the database.
```

## Listening

A server program asks the operating system for a port and waits. This is called **listening**. From then on, the system hands every new connection for that port to that program.

Only one program can listen on a given address and port at a time. If a second one tries, the system refuses, and you see an error such as "address already in use". The usual cause is an older copy of the same program that is still running.

When a packet arrives for a port that nobody listens on, the system answers with a refusal. The client sees "connection refused" almost at once. That quick refusal is useful: it proves the machine was reached and that the fault is the missing program, not the network.

## Which interface it listens on

A server listens on a port **and** on an address. The address decides which interface it accepts connections from.

- `127.0.0.1` means loopback only. Only programs on the same machine can connect.
- A specific address such as `10.0.1.5` means only connections that arrive at that interface.
- `0.0.0.0` means every interface the machine has.

This is the most common reason a server "works on my machine" and nowhere else. Many development servers listen on `127.0.0.1` by default, which is a safe default. To let another machine reach the server, it has to listen on `0.0.0.0` or on the right interface.

```text example bind readonly
   server listening on 127.0.0.1:8080

   same machine  ---> 127.0.0.1:8080      accepted
   other machine ---> 192.168.1.23:8080   refused (nobody listens there)

   server listening on 0.0.0.0:8080

   same machine  ---> 127.0.0.1:8080      accepted
   other machine ---> 192.168.1.23:8080   accepted
```

## Works locally only {prediction}

A developer starts an API on their laptop. Its log says `Listening on http://127.0.0.1:3000`. A teammate on the same office network opens `http://192.168.1.23:3000`, where `192.168.1.23` is the laptop's Wi-Fi address.

:::question local-only
What does the teammate see?
- [ ] The API's response, because both machines are on the same network :: Being on one network gets the packet to the laptop. Nothing on the laptop listens at the Wi-Fi address.
- [x] Connection refused :: The laptop is reached, and no program listens on port 3000 at the Wi-Fi address, so the system refuses.
- [ ] A timeout after about 30 seconds :: A timeout means no answer at all. Here the laptop answers at once with a refusal.
:::

## The client's port

The client needs a port too, so that the response can find its way back to the right program. The client does not choose it. The operating system picks a free one from a high range, usually above 32768, for each new connection. This is an **ephemeral port**: it is used for that one connection and then released.

A connection is identified by four values together: the client address, the client port, the server address and the server port. That is why one browser can hold several connections to the same server at once. They differ in the client port.

```text example four readonly
   client 198.51.100.7                       server 203.0.113.10

   :51514  <------- connection 1 ------->  :443
   :51515  <------- connection 2 ------->  :443
   :51516  <------- connection 3 ------->  :443

   Same server port every time. The client port tells them apart.
```

## See what is listening

Every system has a command that lists the ports in use and the program that holds each one.

```bash example listening readonly
# Linux
ss -ltnp

# macOS
lsof -iTCP -sTCP:LISTEN -n -P

# Windows (PowerShell)
Get-NetTCPConnection -State Listen
```

Read two columns first: the local address and the port. `127.0.0.1:3000` is reachable only from the same machine. `0.0.0.0:3000` or `*:3000` is reachable from other machines, if a firewall allows it.

## Refused or timed out {prediction}

A client tries to connect to `10.0.2.8:5432`. After 30 seconds it reports a timeout. On the server, the database is running and listening on `0.0.0.0:5432`.

:::question refused-timeout
What is the most likely cause?
- [ ] The database is listening on the wrong interface :: `0.0.0.0` accepts every interface, and a wrong interface would give a quick refusal, not a timeout.
- [ ] Another program already uses port 5432 :: Then the database would have failed to start with "address already in use".
- [x] Something between the two machines drops the packets, such as a firewall :: No answer at all means the packets never reached the server, or the replies never came back.
:::

## Exercise: read the listing {independent}

A server gives this listing:

```text
Local address      Program
127.0.0.1:5432     postgres
0.0.0.0:22         sshd
0.0.0.0:8080       api
10.0.1.5:9090      metrics
```

The machine has two interfaces: `10.0.1.5` on a private network and `203.0.113.40` on the public internet. For each of the four programs, write who can connect: the same machine only, the private network, or anyone on the internet. Then say which line you would change first, and why.

## One possible answer {walkthrough}

| Program | Reachable from |
| --- | --- |
| `postgres` | The same machine only. |
| `sshd` | Both interfaces, so the private network and the internet. |
| `api` | Both interfaces, so the private network and the internet. |
| `metrics` | The private network only, since it listens on `10.0.1.5`. |

The database is set up well: only the API on the same machine can reach it.

The line to look at first is `sshd`. A remote terminal open to the whole internet is tried by automated scans all day. It is better limited by a firewall to a few source addresses, or bound to the private interface and reached through a VPN. Whether the API should be public depends on what it is for. If it is, it is normally placed behind a proxy on port 443, which a later module covers.

This paragraph is general guidance, not a statement of any organization's policy.
