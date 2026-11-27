---
id: course:networking/module/firewalls
title: Firewalls and network rules
requires: []
outcomes: []
tasks: []
drills: []
---

A route decides where a packet can go. A firewall decides whether it is allowed to. This module covers how rules are written, why replies do not need their own rule, and how to lay out a network so that a mistake exposes less.

## What a firewall checks

A **firewall** looks at each packet and allows or drops it by comparing it with a list of rules. A basic rule uses facts from the packet's headers.

- the direction: **inbound** (arriving) or **outbound** (leaving)
- the protocol: TCP or UDP
- the destination port
- the source or destination address range

Firewalls sit in several places: on the machine itself, on the router at the edge of a network, and in cloud platforms as rules attached to a machine or a subnet. Cloud platforms call these security groups or network security groups. A packet may pass several of them, and every one must allow it.

```text example rules readonly
   inbound rules for the web servers

   #   protocol   port   source            action
   1   TCP        443    0.0.0.0/0         allow    anyone, HTTPS
   2   TCP        22     10.0.9.0/24       allow    admins' subnet, SSH
   -   any        any    any               deny     everything else
```

## Deny by default

The last line in that table is the important one. A well-built firewall **denies by default**: anything that no rule allows is dropped. You then list what is needed and nothing more.

The opposite design, allowing everything and blocking known bad things, fails quietly. Every service that someone starts later is exposed until somebody remembers to block it.

A rule should be as narrow as the need. "TCP 5432 from the application subnet" is a good rule. "Any port from anywhere" is the absence of a firewall.

## Stateful rules

A connection has packets in both directions. You do not have to write a rule for the replies, because nearly all firewalls are **stateful**: they remember each connection that was allowed, and let its replies back through.

So the rule "allow inbound TCP 443" is enough for a web server. The responses leave without an outbound rule. In the same way, a machine with no inbound rules at all can still call out to other services and receive their answers.

Direction is always about who starts the connection, not about which way most of the data flows. A machine that downloads a large file from a server made an **outbound** connection.

```text example stateful readonly
   rule: allow inbound TCP 443

   client ----- SYN to :443 -------> [firewall] ----> server
                                     allowed by the rule
                                     remembers this connection

   client <---- replies ------------ [firewall] <---- server
                                     allowed, because they belong
                                     to a remembered connection
```

## Which rule is needed {prediction}

An application server must call a payment service on the internet at port 443 and receive its answers. The server's firewall currently denies everything in both directions.

:::question direction
Which single rule makes this work?
- [ ] Allow inbound TCP 443 :: That would let others start connections to the server. The server is the one starting the connection here.
- [x] Allow outbound TCP 443 :: The server starts the connection, so it is outbound. The answers return on the remembered connection.
- [ ] Allow inbound and outbound TCP 443 :: The outbound rule alone is enough. The inbound rule would open the server to connections it does not need.
:::

## Drop or reject

A firewall can refuse a packet in two ways.

- **Drop.** Discard it and say nothing. The client waits and eventually times out.
- **Reject.** Discard it and send back a refusal. The client fails at once.

Most firewalls facing the internet drop, so that a scan learns as little as possible. This is why a firewall problem usually shows up as a timeout, and a missing program as a quick refusal. It is the most useful single clue you have.

| Client sees | Usually means |
| --- | --- |
| Connection refused, at once | Reached the machine, nothing listens on the port |
| Timeout | A firewall dropped it, or there is no route |
| Works from one place, times out from another | A rule limited by source address |

## Layout: public and private subnets

Rules are easier to get right when the network is cut into zones.

- A **public subnet** holds the few things the internet must reach, usually only load balancers.
- A **private subnet** holds application servers. They have no public address. Only the load balancers may reach them.
- A further private subnet holds the databases. Only the application servers may reach it.

Each layer accepts traffic only from the layer in front of it. If one rule is wrong, there is still another layer behind it. This idea is called **defence in depth**.

```text example zones readonly
   internet
      |
      |  443 from anywhere
      v
   +------------------------+
   | public subnet          |   load balancer
   +------------------------+
      |
      |  8080 from the load balancer only
      v
   +------------------------+
   | private subnet: apps   |   application servers, no public address
   +------------------------+
      |
      |  5432 from the app subnet only
      v
   +------------------------+
   | private subnet: data   |   databases
   +------------------------+
```

## Rules by name, not by address

Addresses change as machines are replaced. Most platforms let a rule refer to a group of machines by name: "allow port 5432 from members of the `app` group". A new application server joins the group and is allowed at once. A machine that leaves the group loses access.

Prefer this to lists of addresses. A list of addresses is correct on the day it is written and slowly goes out of date, in both directions: new machines are blocked, and old addresses stay allowed after they are given to something else.

## The rule that is too wide {prediction}

To fix a connection problem quickly during an incident, someone adds this inbound rule to the database: "allow TCP 5432 from `0.0.0.0/0`". The database has only a private address.

:::question too-wide
What is the effect?
- [ ] None, because a private address cannot be reached from the internet :: That is true for the internet, and the rule also covers every machine inside the private network.
- [x] Every machine in the private network can now reach the database :: The private address keeps the internet out. Inside, one compromised or misconfigured machine anywhere can now connect.
- [ ] The database is now reachable from the internet :: Not directly, since it has no public address. The harm is inside the network.
:::

## Exercise: write the rules {independent}

A system has a load balancer, two application servers on port 8080, a database on port 5432, and an admin subnet `10.0.9.0/24` whose machines may open SSH (port 22) to the application servers. The application servers call an external email service on port 443.

Write the inbound rules for each of the three layers and the outbound rule the application servers need. Use group names for sources where you can. Everything else is denied.

## One possible answer {walkthrough}

**Load balancer, inbound**

| Protocol | Port | Source |
| --- | --- | --- |
| TCP | 443 | `0.0.0.0/0` |

**Application servers, inbound**

| Protocol | Port | Source |
| --- | --- | --- |
| TCP | 8080 | group `load-balancer` |
| TCP | 22 | `10.0.9.0/24` |

**Database, inbound**

| Protocol | Port | Source |
| --- | --- | --- |
| TCP | 5432 | group `app` |

**Application servers, outbound**

| Protocol | Port | Destination |
| --- | --- | --- |
| TCP | 5432 | group `database` |
| TCP | 443 | the email service, or `0.0.0.0/0` if its addresses are not fixed |

No rule is needed for replies, since the firewalls are stateful. Port 80 is left out on purpose. If the site should redirect plain HTTP to HTTPS, add TCP 80 from anywhere on the load balancer only.

These rules are an example for learning, and general guidance. They are not a statement of any organization's policy.
