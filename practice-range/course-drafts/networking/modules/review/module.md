---
id: course:networking/module/review
title: Trace and review a request path
requires: []
outcomes: []
tasks: []
drills: []
---

This module has no new ideas. You trace one request from end to end, review a network layout with faults in it, and plan one of your own. Do each exercise on paper before you read its answer.

## How to use this module

Each exercise has a step where you work alone and a step with one possible answer. The answers are not the only good ones. Compare your reasoning with them, and pay most attention to anything you did not think of at all.

When you review a layout, ask the same questions each time.

1. What can reach what, and should it?
2. Where does a single failure stop everything?
3. Where does a request wait, and for how long?
4. What would you see from the client if each part failed?

## Trace 1: one request, every step {independent}

A user in another country opens `https://shop.example.com/cart` for the first time today. The site has a CDN for images, a layer 7 load balancer that terminates TLS, three application servers in a private subnet, and a database.

Write every network step that happens before the cart appears, in order. Include each lookup, each handshake and each connection. For each step, name the protocol and say what would be seen if it failed.

```text example trace-layout readonly
   user's browser
        |
        v
   DNS resolver ......... shop.example.com -> 203.0.113.10
        |
        v
   load balancer   203.0.113.10:443      (public subnet, TLS ends here)
        |
        v
   app servers     10.0.1.5, .6, .7 :8080   (private subnet)
        |
        v
   database        10.0.2.8:5432            (private subnet)
```

## Count the round trips {prediction}

In trace 1 the user's round-trip time to the load balancer is 150 ms. Nothing is cached, and the browser uses TLS 1.3.

:::question first-byte
About how long is it before the first byte of the response can arrive, ignoring server work and the DNS lookup?
- [ ] 150 ms :: That would be a single round trip. The TCP and TLS handshakes come first.
- [x] 450 ms :: One round trip for the TCP handshake, one for TLS and one for the request and response.
- [ ] 900 ms :: That counts the connections behind the load balancer. Those are inside one data centre and cost about a millisecond each.
:::

## Trace 1: one possible answer {walkthrough}

| Step | Protocol | If it fails, the user sees |
| --- | --- | --- |
| 1. Resolve `shop.example.com` | DNS over UDP | "Site can't be found" |
| 2. Route packets to `203.0.113.10` through the home router's NAT and many hops | IP | A timeout |
| 3. TCP handshake with the load balancer on port 443 | TCP | Refused or a timeout |
| 4. TLS handshake. The browser checks the chain, the name and the dates | TLS | A certificate warning |
| 5. Send `GET /cart` with `Host` and the session cookie | HTTP | - |
| 6. The load balancer picks a healthy server and sends the request to `10.0.1.6:8080` on a connection it keeps open, with `X-Forwarded-For` | HTTP over TCP | `502`, `503` or `504` |
| 7. The application takes a pooled connection and queries `10.0.2.8:5432` | TCP | `500`, or `504` if slow |
| 8. The response returns along the same two connections | HTTP | A partial page |
| 9. The browser resolves the CDN's name and fetches images from a nearby cache | DNS, TCP, TLS, HTTP | Missing images |

Three things are easy to leave out. NAT at the user's end is part of the path. Steps 6 and 7 use connections that are already open, which is why they are cheap. Step 9 is a second, separate journey to a different server.

## Review 1: a network layout {independent}

Read this description of a system and list every problem you find. Rank them by how urgent they are.

```text example flawed readonly
   internet
      |
      +--> web server        203.0.113.30   ports open: 22, 80, 443, 8080
      |    (public address)                 from 0.0.0.0/0
      |
      +--> database          203.0.113.31   port open: 5432
           (public address)                 from 0.0.0.0/0
                                            "we use a strong password"

   - one web server, no load balancer
   - shop.example.com   A   203.0.113.30   TTL 86400
   - the certificate is renewed by hand when someone remembers
   - the web server calls a payment API with no timeout
     and retries 5 times, immediately
   - the app reads the client address from X-Forwarded-For
```

## The most urgent one {prediction}

Before you read the full list, choose from three of the faults.

:::question most-urgent
Which fault in review 1 would you fix first?
- [x] The database is reachable from the whole internet :: Anyone can try passwords against it and attack flaws in the database software itself. A firewall rule that allows only the web server removes the exposure in minutes.
- [ ] The one-day TTL on the DNS record :: It makes moving the site slow. It does not expose anything.
- [ ] The missing load balancer :: It limits availability. It is a larger project and less urgent than an exposed database.
:::

## Review 1: what is wrong {walkthrough}

**Exposure**

1. **The database is public.** It needs no public address at all. Put it in a private subnet and allow port 5432 from the web server only. A password is not a reason to skip the firewall.
2. **SSH is open to everyone.** Limit port 22 to an admin range or a VPN.
3. **Port 8080 is open.** It is probably the application behind a proxy on the same machine. If so, clients can bypass the proxy. Listen on loopback and close the port.
4. **`X-Forwarded-For` is trusted from anyone.** No proxy of the team's own writes it, so any client can claim any address.

**Availability**

5. **One web server.** Any failure or deploy is an outage. Use at least two behind a load balancer, in separate zones.
6. **A hand-renewed certificate.** One forgotten date takes the site down for every user at once. Renew automatically and alert weeks ahead.
7. **A one-day TTL.** If the server must be replaced in a hurry, some users are sent to the old address for a day. Use a few minutes, or point the name at a load balancer whose address does not change.

**Behaviour under failure**

8. **No timeout on the payment call.** If the payment API hangs, every request that calls it hangs, and the server runs out of capacity.
9. **Five immediate retries of a payment.** They multiply load on a struggling service, and a charge is not idempotent unless a key is sent. A customer could be charged several times.

Points 1 to 4 are general guidance on reducing exposure, not a statement of any organization's policy.

## Design: a small internal tool {independent}

Plan the network for an internal expenses tool. About 300 employees use it from the office network (`10.50.0.0/16`) and through a VPN. It has a web application, a database, and it sends email through an external provider. It must survive the loss of one server, and it must not be reachable from the internet.

Write down: the subnets and their ranges, what listens where, the firewall rules, the DNS record, where TLS ends, the health check, and the timeouts for the outbound email call.

## Design: one possible answer {walkthrough}

**Subnets**, in a block that does not overlap the office: `10.60.0.0/16`.

| Subnet | Range | Holds |
| --- | --- | --- |
| Balancer | `10.60.1.0/24` | An internal load balancer, private address only |
| Application | `10.60.2.0/24` | Two application servers in separate zones |
| Data | `10.60.3.0/24` | The database, with a standby copy |

**Firewall rules**, with everything else denied.

| Target | Allow inbound |
| --- | --- |
| Load balancer | TCP 443 from `10.50.0.0/16` and the VPN range |
| Application | TCP 8080 from the load balancer |
| Database | TCP 5432 from the application group |

Outbound from the application: 5432 to the database, and 443 to the email provider through a NAT gateway. Nothing has a public address, so nothing can be reached from the internet.

**DNS.** `expenses.internal.example.com`, a record in internal DNS only, pointing at the load balancer, with a TTL of 300.

**TLS.** It ends at the load balancer, with a certificate from the company's CA that employee machines already trust. Renewal is automatic.

**Health check.** `GET /health` every 10 seconds. It checks the process and this server's database connection. It does not call the email provider.

**Email call.** Connect timeout 2 seconds, read timeout 10 seconds, at most two retries with backoff and jitter. Better: place the email on a queue, so that a slow provider never delays a user's request.

The survival requirement is met for the application by two servers and for the data by the standby. The decision that prevents the most trouble later is the first one: a block that does not overlap the office's.

## Where to go next {explanation}

You can now follow a request through names, addresses, ports, connections, encryption, proxies and load balancers, and test each stage on its own.

Three habits are worth keeping.

- **Ask which stage failed** before asking why.
- **Compare two viewpoints.** Where it works and where it fails tells you more than either alone.
- **Give every call a time limit**, and decide what happens when it is reached.

The system design course builds on this one. It uses these parts, together with caches, queues and databases, to design whole systems and to reason about what happens to them under load and failure.
