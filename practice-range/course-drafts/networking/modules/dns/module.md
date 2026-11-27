---
id: course:networking/module/dns
title: Names and DNS
requires: []
outcomes: []
tasks: []
drills: []
---

People use names and packets need addresses. DNS turns one into the other. This module covers how a lookup works, what the common records mean, and why a DNS change does not take effect everywhere at once.

## What DNS does

**DNS** (the Domain Name System) is a worldwide lookup service. A client gives it a name such as `shop.example.com` and gets back an address such as `203.0.113.10`. This is called **resolving** the name.

Resolving happens before the connection opens. If it fails, nothing is ever sent to the server, and no server log will show the attempt.

A name is read from right to left. `com` is the top-level domain. `example.com` is a domain that someone registered under it. `shop.example.com` is a name inside that domain, chosen by its owner.

## How a lookup travels

Your machine does not ask the whole internet. It asks one **resolver**, usually run by your internet provider, your company or a public service. The resolver does the walking.

1. The resolver asks a **root server** where to find `com`.
2. It asks a `com` server where to find `example.com`.
3. It asks the **authoritative server** for `example.com`, which holds the real records, for `shop.example.com`.
4. It returns the answer to your machine and keeps a copy.

The authoritative server is the one place where the domain's owner edits records. Everything else is a copy.

```text example lookup readonly
   your machine                resolver
       |  shop.example.com?       |
       |------------------------->|   1. root:        "ask the com servers"
       |                          |   2. com:         "ask example.com's
       |                          |                    servers"
       |                          |   3. example.com: "203.0.113.10"
       |   203.0.113.10           |
       |<-------------------------|   4. keeps a copy for next time
```

## Records

A domain's data is a list of **records**. Each has a name, a type and a value.

| Type | Meaning | Example value |
| --- | --- | --- |
| `A` | The IPv4 address of a name | `203.0.113.10` |
| `AAAA` | The IPv6 address of a name | `2001:db8::10` |
| `CNAME` | This name is an alias of another name | `shop.hosting.example.net` |
| `MX` | Where mail for the domain goes | `mail.example.com` |
| `TXT` | Free text, often used to prove ownership | `verify=abc123` |
| `NS` | Which servers are authoritative for the domain | `ns1.example.net` |

A `CNAME` adds a step. The client looks up the alias, gets another name, and looks that one up. It is how a service hosted by someone else is given a name in your domain: you point your name at theirs, and they are free to change the address behind it.

One name can have several `A` records. The client gets all of them and normally tries the first, which spreads clients across several servers in a simple way.

```text example records readonly
   name                    type    value                        TTL
   example.com             A       203.0.113.10                 3600
   www.example.com         CNAME   example.com                  3600
   shop.example.com        CNAME   shop.hosting.example.net     300
   example.com             MX      10 mail.example.com          3600
   api.example.com         A       203.0.113.20                 60
   api.example.com         A       203.0.113.21                 60
```

## Caching and TTL

Every record carries a **TTL** (time to live): the number of seconds a copy may be kept. A resolver that has a copy answers from it until the TTL runs out, without asking the authoritative server again. Your operating system and your browser keep copies as well.

Caching makes DNS fast. It also means a change is not seen everywhere at the same moment. After you change a record, each resolver keeps giving the old value until its own copy expires. For a TTL of 3600, some clients see the new address at once and others up to an hour later.

People call this "DNS propagation". Nothing is being pushed out. Old copies are expiring at different times.

## The change that did not arrive {prediction}

A record for `shop.example.com` has a TTL of 86400 (one day). At 09:00 the owner changes its address from the old server to a new one and switches the old server off at 09:05.

:::question ttl-change
What do visitors see during the rest of that day?
- [ ] All of them reach the new server from 09:00 :: Resolvers that looked the name up earlier still hold the old address.
- [x] Some reach the new server, and others fail until their resolver's copy expires :: Each cached copy lives for up to a day. Those clients are sent to a server that is now off.
- [ ] All of them fail until the next day :: A resolver with no copy, or an expired one, asks again and gets the new address.
:::

## Plan a change around the TTL

The safe way to move a name is to plan for the cache.

1. Days before, lower the TTL to something short, such as 60 seconds. Wait for the old TTL to pass, so every cached copy has the short one.
2. Make the change. Within about a minute, nearly every client has the new address.
3. Keep the old server running until its traffic has stopped.
4. Raise the TTL again.

A short TTL means more lookups and faster changes. A long TTL means fewer lookups and slow changes. Names that sit in front of things you may need to move quickly, such as a failover, are given short TTLs on purpose.

## Look a name up

Two commands ask DNS directly, which removes the browser and its cache from the picture.

```bash example dig readonly
# Ask the default resolver for the A records
dig shop.example.com A

# Ask one specific resolver
dig @9.9.9.9 shop.example.com A

# Short answer only
dig +short shop.example.com

# Windows
nslookup shop.example.com
```

In the answer, read the type, the value and the number before them, which is the TTL the resolver has left. Asking a second resolver is the quick way to see whether a change has reached some places and not others.

Two answers are easy to confuse. `NXDOMAIN` means the name does not exist. An empty answer with no error means the name exists and has no record of the type you asked for.

## Which failure {prediction}

A new service is given the name `reports.example.com`. From the office it resolves and loads. From a laptop at home, `dig reports.example.com` returns `NXDOMAIN`, while other names in `example.com` resolve.

:::question split-view
What is the most likely explanation?
- [ ] The home resolver's copy has not expired yet :: An old copy of an existing record would give an old address, not "does not exist". A cached NXDOMAIN is possible, and it clears within minutes.
- [x] The record exists only in a DNS server that the office uses :: Companies often run internal DNS for names that should resolve only inside their network. The public servers have no such record.
- [ ] The service is down :: DNS does not check whether the server is running. A record resolves the same either way.
:::

## Exercise: move a site {independent}

`www.example.com` has an `A` record with a TTL of 14400 (four hours) that points at an old server. You must move it to a new server on Thursday at 10:00 with as little failed traffic as possible. Write the steps with times. Say when the old server can be switched off, and how you would check your work before and after.

## One possible answer {walkthrough}

1. **Wednesday, before 06:00.** Lower the TTL to 60. Copies taken before this moment last up to four hours, so by 10:00 on Wednesday every resolver holds a copy with the short TTL. Doing it a day early leaves room for error.
2. **Thursday, before 10:00.** Check that the new server answers correctly by sending requests straight to its address, without using the name.
3. **Thursday 10:00.** Change the `A` record to the new address. Check with `dig` against two different resolvers.
4. **Thursday 10:05 onwards.** Watch the old server's traffic. It should fall to almost nothing within a few minutes. Some clients ignore TTLs and keep an address for longer, so leave the old server running for a day or two.
5. **Later.** Switch the old server off, and raise the TTL back to a few hours.

The step people forget is the first. Lowering the TTL at the moment of the change does nothing for copies that are already cached with four hours left.
