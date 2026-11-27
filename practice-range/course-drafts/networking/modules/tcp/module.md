---
id: course:networking/module/tcp
title: TCP and UDP
requires: []
outcomes: []
tasks: []
drills: []
---

The network delivers single packets and may lose them. The transport layer turns that into something programs can use. This module covers the two transport protocols, what a TCP connection costs, and how one ends.

## What TCP adds

**TCP** (Transmission Control Protocol) gives two programs a **connection**: a two-way stream of bytes that arrives complete and in order. To do that, it adds four things on top of plain packets.

- **Numbering.** Every byte has a sequence number, so the receiver can put packets back in order.
- **Acknowledgement.** The receiver reports which bytes arrived. The sender sends again whatever is not acknowledged in time.
- **Flow control.** The receiver says how much it can take, so a fast sender cannot flood a slow receiver.
- **Congestion control.** The sender slows down when packets are being lost, since loss usually means a router on the path is overloaded.

The program sees none of this. It writes bytes in at one end and reads the same bytes out at the other.

## Opening a connection

Before any data moves, the two sides exchange three small packets. This is the **three-way handshake**.

1. The client sends `SYN`: "I want to connect, and my numbering starts here."
2. The server answers `SYN-ACK`: "Accepted, and my numbering starts here."
3. The client sends `ACK`: "Received."

The cost is one **round trip**: the time for a packet to go to the server and for the answer to come back. On a path with 80 ms of round-trip time, every new connection waits 80 ms before the first byte of the request can be sent. This is one reason programs keep connections open and reuse them.

```text example handshake readonly
   client                                   server (listening on :443)
     |                                         |
     |---- SYN ------------------------------->|
     |<--- SYN-ACK ----------------------------|   one round trip
     |---- ACK ------------------------------->|
     |                                         |
     |---- request bytes --------------------->|
     |<--- response bytes ---------------------|
```

## What the three failures look like

The handshake fails in three different ways, and each tells you something different.

| What the client sees | What happened | Likely cause |
| --- | --- | --- |
| Connection refused, at once | The machine answered with a reset (`RST`) | No program listens on that port |
| Timeout, after many seconds | No answer to the `SYN` at all | A firewall drops the packets, or the address is wrong or the machine is off |
| Connection reset, later | An open connection was cut with `RST` | The server program crashed, or a device in the middle closed an idle connection |

A refusal is quick because something replied. A timeout is slow because the client keeps sending `SYN` again and waiting, for 20 seconds or more by default.

## Loss inside a connection {prediction}

A client is downloading a file over TCP. One packet in the middle is lost. The packets after it arrive normally.

:::question tcp-loss
What does the receiving program see?
- [ ] The file with a gap where the lost packet was :: TCP never hands data to the program with a hole in it.
- [ ] The later bytes first, and the missing ones when they arrive :: TCP delivers in order. Later bytes wait until the gap is filled.
- [x] A short pause, then all the bytes in order :: TCP holds the later packets, waits for the lost one to be sent again, and then delivers everything in order.
:::

## Closing a connection

Each side closes its own direction by sending `FIN`, and the other side acknowledges it. A clean close therefore takes four packets, and one side can finish sending while it still receives.

A `RST` is the unclean way. It ends the connection at once and throws away anything not yet delivered. A program that reads from a connection the other side has reset gets an error such as "connection reset by peer".

Connections also end without either program choosing it. Firewalls, load balancers and home routers keep a table of open connections and drop entries that have been silent for too long, often after a few minutes. The two programs do not find out until one of them sends something. Long-lived connections avoid this by sending a small **keepalive** message at regular intervals.

```text example idle readonly
   app                    firewall                   database
    |  open connection       |                          |
    |----------------------->|------------------------->|
    |  ... 10 minutes of silence ...                    |
    |                        |  entry removed           |
    |  next query            |                          |
    |----------------------->X  dropped: unknown        |
    |                           connection              |
    |  waits, then: "connection reset" or a timeout     |
```

## UDP

**UDP** (User Datagram Protocol) adds almost nothing to plain packets. It adds ports, so a packet reaches the right program, and a checksum to detect damage. There is no handshake, no ordering, no resending and no connection.

A program sends a UDP packet and it may arrive once, never, twice or out of order. That sounds worse in every way, and for some uses it is better.

- **A lookup of one question and one answer.** DNS sends a query in one packet and gets the answer in one packet. A handshake would triple the work.
- **Live audio and video.** A packet that arrives late is useless. It is better to skip it than to pause the call while it is sent again.
- **Protocols that bring their own rules.** HTTP/3 runs on QUIC, which is built on UDP and does its own ordering and resending.

| | TCP | UDP |
| --- | --- | --- |
| Setup | Handshake, one round trip | None |
| Delivery | Complete and in order | Best effort |
| Unit | A stream of bytes | Separate packets |
| Typical use | HTTP, databases, SSH | DNS, calls, games, QUIC |

## Which protocol {prediction}

A team builds a voice chat feature. Sound is cut into packets of 20 ms each. About 1 packet in 100 is lost on a typical mobile connection.

:::question voice
Why is UDP the usual choice here?
- [ ] UDP loses fewer packets than TCP :: Both run over the same network and lose the same packets. They differ in what happens next.
- [x] Waiting for a lost packet would delay all the sound after it :: With TCP, 20 ms of lost sound would hold back everything behind it. Skipping 20 ms is barely heard.
- [ ] UDP packets are encrypted by default :: Neither protocol encrypts anything on its own.
:::

## Many short connections

Since each new TCP connection costs a round trip, and a secure one costs more, a program that opens a connection for every request pays that price every time. Two habits remove most of it.

- **Keep the connection open** and send the next request on it. HTTP does this by default.
- **Use a connection pool.** A program that talks to a database keeps a small set of open connections and lends one to each piece of work.

A pool has a limit. If every connection is lent out, the next piece of work waits. Under heavy load that wait can look like a network problem when no packet is being lost.

## Exercise: read the symptom {independent}

For each report, say whether the client was refused, timed out, or was reset, and name one likely cause.

1. A service reports "connect: connection refused" for `10.0.2.8:6379` the moment it starts.
2. A nightly job that runs one query every 30 minutes fails on its second query with "connection reset by peer". The first always works.
3. A new server in a different subnet cannot reach the database. Each attempt hangs for 30 seconds.

Then answer: which of the three would you expect to be fixed by restarting the client, and why is that not a real fix?

## One possible answer {walkthrough}

1. **Refused.** The machine at `10.0.2.8` answered, and nothing listens on port 6379. The cache server is not running, or it listens on `127.0.0.1` only.
2. **Reset.** The job keeps one connection open and is silent for 30 minutes. A firewall or the database itself drops idle connections sooner than that. The second query is sent on a connection that no longer exists.
3. **Timeout.** No answer to the `SYN`. A firewall rule does not allow the new subnet, or there is no route between the subnets.

Restarting helps only with the second. A fresh client opens a fresh connection, so the first query works again, and the fault returns 30 minutes later. The real fixes are a keepalive, a pool that checks a connection before lending it, or opening a new connection for each run of the job.
