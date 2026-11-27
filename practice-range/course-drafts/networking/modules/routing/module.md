---
id: course:networking/module/routing
title: Routing, gateways and NAT
requires: []
outcomes: []
tasks: []
drills: []
---

A machine has to decide where to send each packet, and so does every router after it. This module covers how that decision is made, how private machines reach the internet, and why the reverse direction needs extra work.

## The first decision

When a machine sends a packet, it asks one question: is the destination in my own subnet?

- **Yes.** The packet is sent straight to that machine over the local link.
- **No.** The packet is sent to the **default gateway**, which is the router that connects this subnet to everything else.

A machine with the address `10.0.1.5` in the subnet `10.0.1.0/24` reaches `10.0.1.9` directly. For `203.0.113.10` it hands the packet to its gateway, often the first address in the subnet, such as `10.0.1.1`.

A machine with no gateway, or the wrong one, can talk to its neighbours and to nothing else. That exact symptom points here.

```text example gateway readonly
   subnet 10.0.1.0/24

   +-----------+        +-----------+        +-----------------+
   | 10.0.1.5  |------->| 10.0.1.9  |        | gateway         |
   | (sender)  | direct | neighbour |        | 10.0.1.1        |----> rest
   +-----------+        +-----------+        +-----------------+     of the
         |                                           ^               world
         +---- anything outside 10.0.1.0/24 ---------+
```

## Route tables

The rule above is a small **route table**: a list of destination ranges and where to send packets for each. Every machine and every router has one.

When several entries match a destination, the most specific one wins, which is the one with the longest prefix. `0.0.0.0/0` matches everything and is the least specific, so it acts as the default.

```text example routes readonly
   destination       send to            meaning
   10.0.1.0/24       direct             my own subnet
   10.0.0.0/16       10.0.1.254         the rest of the private network
   0.0.0.0/0         10.0.1.1           everything else (default)

   packet to 10.0.1.9      -> matches all three, /24 wins -> direct
   packet to 10.0.7.20     -> matches /16 and /0, /16 wins -> 10.0.1.254
   packet to 203.0.113.10  -> matches only /0 -> 10.0.1.1
```

## Which route {prediction}

Using the route table above, a machine sends a packet to `10.0.200.4`.

:::question which-route
Where is the packet sent?
- [ ] Directly, because the address starts with `10.0.` :: Direct delivery needs a match on `10.0.1.0/24`. The third number here is 200.
- [x] To `10.0.1.254` :: The address is inside `10.0.0.0/16` and outside `10.0.1.0/24`. The `/16` entry is more specific than the default.
- [ ] To `10.0.1.1`, the default gateway :: The default is used only when nothing more specific matches.
:::

## Both directions need a route

A connection needs packets to flow both ways. The request follows the routes on the way out, and the reply follows the routes of every device on the way back. Those are separate tables.

A common fault is a route in one direction only. The request arrives, the server answers, and the answer is sent somewhere else or dropped. From the client it looks like a timeout, and the server's log shows that the request came in. That pair of facts points at the return path.

## NAT: many machines behind one address

Private addresses cannot be used on the internet. **NAT** (network address translation) is how a private machine still reaches a public server.

The gateway has one public address. When a private machine sends a packet out, the gateway rewrites the source to its own public address and a port it chooses, and writes the mapping in a table. When the reply comes back to that port, the gateway looks up the table, rewrites the destination to the private machine, and passes it on.

The server on the other side never sees the private address. It sees one public address, shared by every machine behind that gateway.

```text example nat readonly
   private network                gateway                    internet
                               public 198.51.100.7

   10.0.1.5:51514  ---->  rewrites source to      ---->  203.0.113.10:443
                          198.51.100.7:40001

                          table: 40001 = 10.0.1.5:51514

   10.0.1.5:51514  <----  rewrites destination    <----  reply to
                          back to 10.0.1.5:51514         198.51.100.7:40001
```

## What NAT means in practice

- **Outbound just works.** A private machine can start connections to the internet.
- **Inbound does not.** A packet from outside arrives at the gateway with no table entry, and the gateway has no idea which private machine it is for. It is dropped. To accept inbound connections, the gateway needs a fixed rule, called **port forwarding**, or the machine needs a public address or a load balancer in front of it.
- **Everyone looks like one address.** A server sees all users behind one office as a single address. Limits and blocks that work per address affect all of them together.
- **Table entries expire.** A silent connection loses its entry after a few minutes, which is the idle cut described in the TCP module.

Cloud networks use the same idea. A subnet whose machines have only private addresses sends outbound traffic through a NAT gateway, and receives inbound traffic through a load balancer.

## Inbound through NAT {prediction}

A developer runs a web server on a laptop at home on port 8080. It listens on `0.0.0.0`. The home router's public address is `198.51.100.7`. A friend elsewhere opens `http://198.51.100.7:8080`.

:::question inbound-nat
What happens?
- [ ] The laptop answers, since the server listens on every interface :: Listening on every interface makes the laptop reachable inside the home network. The packet stops at the router first.
- [x] The router drops the packet, because no rule says which machine port 8080 belongs to :: NAT only knows about connections that were started from inside. An unexpected inbound packet matches nothing.
- [ ] The friend reaches some other device in the home :: The router does not guess. Without a forwarding rule nothing receives the packet.
:::

## See the path

`traceroute` (`tracert` on Windows) shows the routers a packet passes. It sends packets that are allowed only 1 hop, then 2, then 3, and each router that discards one reports itself.

```bash example trace readonly
traceroute shop.example.com

#  1  10.0.1.1         1 ms     the default gateway
#  2  198.51.100.1     8 ms     the provider
#  3  * * *                     this router does not answer
#  4  203.0.113.1     21 ms
#  5  203.0.113.10    22 ms     the destination
```

Read it with care. A row of `* * *` in the middle usually means that router does not reply to these probes, and it is still passing traffic. What matters is where the answers stop for good. If nothing answers after hop 2, look at what comes right after hop 2.

## Exercise: one direction only {independent}

A service in subnet A (`10.0.1.0/24`) calls a database in subnet B (`10.0.2.0/24`). Every call times out. You learn these facts:

- From the service, `traceroute` to the database reaches it.
- The database's log shows the incoming connection attempts.
- Subnet B's route table has two entries: `10.0.2.0/24 direct` and `0.0.0.0/0` to an internet gateway.

Explain what happens to the database's replies, and write the route that fixes it.

## One possible answer {walkthrough}

The outward path works: subnet A has a route to subnet B, the packets arrive, and the database logs them.

The database then answers to `10.0.1.5`. Subnet B looks that address up in its own table. It is not in `10.0.2.0/24`, so the only match is the default, and the reply is sent to the internet gateway. Internet routers drop packets for private addresses, so the reply is lost. The service keeps waiting and reports a timeout.

The fix is a route in subnet B for subnet A:

```text
10.0.1.0/24    send to the router that joins the two subnets
```

The method to remember is that a request seen in the server's log together with a timeout on the client means the return path is broken. Check the route table on the answering side.
