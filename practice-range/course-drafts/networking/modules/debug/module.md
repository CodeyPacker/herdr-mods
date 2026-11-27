---
id: course:networking/module/debug
title: Find where a request fails
requires: []
outcomes: []
tasks: []
drills: []
---

"It can't connect" describes a dozen different faults. This module gives you one order in which to test, the command for each step, and a table from error message to cause.

## Test in the order the request travels

A request goes through the same stages every time, and each stage depends on the ones before it.

1. **Name.** Does the name resolve, and to the address you expect?
2. **Path.** Can packets reach that address?
3. **Port.** Does something accept a connection on the port?
4. **TLS.** Does the secure handshake complete, with a valid certificate?
5. **HTTP.** Does the server answer, and with which status?
6. **Application.** Is the answer the right one?

Test them in this order and stop at the first that fails. Everything before it is proven to work, and everything after it cannot be judged yet. This turns a vague report into one narrow question.

```text example ladder readonly
   6  application   is the answer correct?
   5  HTTP          which status code?
   4  TLS           does the handshake complete?
   3  port          does anything accept the connection?
   2  path          do packets reach the address?
   1  name          does the name resolve?

   Start at 1. The first step that fails is where to look.
```

## Step 1: the name

```bash example step-name readonly
dig +short api.example.com
# 203.0.113.20

# nothing printed, or NXDOMAIN: the name does not resolve here
```

Check two things: that there is an answer, and that the address is the one you expect. An old address after a change points at a cached record. A private address where you expected a public one points at an internal DNS server giving a different answer inside the network.

Also check what the failing program uses. A container, a virtual machine and your laptop can each use a different resolver. Run the lookup from the place where the failure happens.

## Steps 2 and 3: the path and the port

One command tests both: try to open a TCP connection to the address and port.

```bash example step-port readonly
# Linux and macOS
nc -vz 203.0.113.20 443

# Windows (PowerShell)
Test-NetConnection 203.0.113.20 -Port 443
```

There are three results, and each one means something different.

| Result | Meaning |
| --- | --- |
| Connected | The path and the port are fine. Move up. |
| Refused, at once | The machine was reached. Nothing listens on that port. |
| Timeout | No answer. A firewall drops the packets, there is no route, or the machine is off. |

`ping` tests the path alone, and it is less useful than it looks. Many networks block the packets that `ping` uses while they allow real traffic. A failed ping proves nothing. A successful TCP connection proves the path and the port.

## Refused from one place only {prediction}

From an application server, `nc -vz 10.0.2.8 5432` times out. From a second machine in the same subnet as the database, the same command connects.

:::question narrow
What does this pair of results tell you?
- [ ] The database is not running :: It accepted a connection from the second machine.
- [ ] The database listens on loopback only :: Then the second machine would be refused too.
- [x] Something between the application server and the database blocks the traffic :: The database works. The difference between the two tests is the path, so look at firewall rules and routes for the application server's subnet.
:::

## Steps 4 and 5: TLS and HTTP

`curl -v` shows both in one run. Read its output from the top.

```bash example step-curl readonly
curl -v https://api.example.com/health

# * Connected to api.example.com (203.0.113.20) port 443      steps 1 to 3
# * SSL connection using TLSv1.3                              step 4
# * subject: CN=api.example.com                               step 4
# > GET /health HTTP/2                                        sent
# < HTTP/2 200                                                step 5
```

Where the output stops is where the failure is. If it stops before "Connected", go back to steps 1 to 3. If it stops with a certificate error, it is step 4. If a status line appears, the whole network path works, and the status code tells you who is unhappy.

Two options help you separate causes.

```bash example step-tricks readonly
# Skip DNS: send the request for this name to a chosen address
curl -v --resolve api.example.com:443:203.0.113.21 \
  https://api.example.com/health

# Show how long each stage took
curl -s -o /dev/null https://api.example.com/health -w \
  "dns %{time_namelookup}  connect %{time_connect}  tls %{time_appconnect}
first byte %{time_starttransfer}  total %{time_total}\n"
```

The first reaches one particular server behind a load balancer and still sends the right name, so TLS and `Host` work. The second prints running totals over two lines, so the gap between two numbers is the time one stage took.

## From message to cause

| Message | Stage | Likely cause |
| --- | --- | --- |
| Could not resolve host, `NXDOMAIN` | Name | Typing error, missing record, wrong resolver |
| Connection refused | Port | Program not running, or listening on another address or port |
| Connection timed out | Path | Firewall, missing route, wrong address, machine off |
| No route to host | Path | No route from this machine to that network |
| Connection reset by peer | Port or later | Program crashed, or an idle connection was cut in the middle |
| Certificate has expired, name mismatch, unknown issuer | TLS | See the TLS module's four checks |
| `502`, `503`, `504` | HTTP | The proxy reached no working backend |
| `401`, `403` | HTTP | The network is fine. The credentials or permissions are not. |
| `404` | HTTP | The network is fine. Wrong path, or wrong site for this `Host`. |

## Compare two viewpoints

The most useful question in network debugging is: from where does it work, and from where does it fail? Run the same test from two places and compare.

- Works on the server itself, fails from another machine: the program listens on loopback, or a firewall on the machine blocks it.
- Works inside the network, fails from outside: an edge firewall, NAT, or a record that exists only in internal DNS.
- Works by address, fails by name: DNS.
- Works for one backend, fails for another: test each one directly with `--resolve`.

Each pair of results removes half of the system from suspicion.

## Change one thing at a time

When a test fails, change one thing and run the same test again. If you change a firewall rule, restart the service and edit DNS together, and it then works, you do not know which change mattered, and two of them may be wrong.

Write down what you tested and what you saw. In a long session it is easy to test the same thing twice, or to remember a result from before a change as if it were current.

## Where the time goes {prediction}

The timing command prints: `dns 0.004  connect 0.030  tls 0.058  first byte 2.960  total 2.961`.

:::question slow-stage
Which stage is slow?
- [ ] The network path, since the total is almost 3 seconds :: The connection opened in 26 ms and TLS took 28 ms. The path is quick.
- [x] The server's work on the request :: From the end of TLS at 0.058 to the first byte at 2.960, the client was waiting for the server to produce a response.
- [ ] The download of the response :: The first byte came at 2.960 and the last at 2.961. The transfer took 1 ms.
:::

## Exercise: walk the ladder {independent}

A colleague reports: "The new reporting service can't reach the billing API. It worked in testing." You are given these results, all run from the reporting service's machine.

```text
dig +short billing.internal.example.com      ->  10.0.3.14
nc -vz 10.0.3.14 443                         ->  succeeded
curl https://billing.internal.example.com/   ->  certificate verify failed:
                                                 unable to get local issuer
curl -k https://billing.internal.example.com/invoices  ->  HTTP 403
```

(`-k` tells curl to skip the certificate check.)

Say which stages are proven to work, where the first failure is, what probably causes it, and what the last line adds. Say what you would not do.

## One possible answer {walkthrough}

**Proven.** The name resolves to a private address, so internal DNS works. A TCP connection to port 443 succeeds, so routes and firewalls allow the traffic and something listens there.

**First failure: TLS.** "Unable to get local issuer" is the chain check. The billing API's certificate is signed by a CA this machine does not trust. For an internal name, that is most likely the company's private CA, which was installed on the test machines and is missing from the new service's machine or container image. It could also be a missing intermediate.

**The last line.** With the check skipped, the request reaches the application and gets `403`. So there is a second, separate problem waiting behind the first: the reporting service's credentials are not allowed to read invoices. That is an application matter, and it would have stayed hidden until TLS was fixed.

**What not to do.** Do not leave `-k`, or its equivalent in code, in the service. Install the CA certificate so the check passes. Then fix the permission. They are two faults, to be fixed one at a time.
