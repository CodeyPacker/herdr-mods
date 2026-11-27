---
id: course:networking/module/proxies
title: Proxies and reverse proxies
requires: []
outcomes: []
tasks: []
drills: []
---

Few requests travel straight from a client to the program that answers them. Something in the middle receives the request and sends it on. This module covers the two kinds of proxy, what a reverse proxy does for a server, and what gets lost on the way.

## Two kinds of proxy

A **proxy** is a program that accepts a request and makes a request of its own to someone else on the sender's behalf. Which side it works for gives it its name.

- A **forward proxy** works for clients. Machines inside a company send their outbound requests to it, and it fetches the pages for them. It can filter, log and cache what leaves the network. The server sees the proxy's address.
- A **reverse proxy** works for servers. Clients connect to it believing it is the site. It passes each request to one of the real servers behind it. The client never learns their addresses.

The rest of this module is about reverse proxies, since nearly every production system has one.

```text example kinds readonly
   FORWARD PROXY  (works for the clients)

   client --+
   client --+--> forward proxy -----> any server on the internet
   client --+

   REVERSE PROXY  (works for the servers)

                                       +--> app server 1
   any client --> reverse proxy -------+--> app server 2
                                       +--> app server 3
```

## Two connections, not one

A reverse proxy does not pass packets through. It ends the client's connection and opens a separate connection to the server behind it. The program behind a proxy is called the **upstream** or the **backend**.

This has consequences that surprise people.

- Each connection has its own timeouts, its own protocol version and its own TLS setup. The client may speak HTTP/2 to the proxy while the proxy speaks HTTP/1.1 to the backend.
- The backend sees a connection from the proxy's address, not from the client's.
- An error can be produced by either one. A `404` may come from the application. A `502` or `504` comes from the proxy.

```text example two-connections readonly
   client                   reverse proxy                  backend
   198.51.100.7             10.0.0.10                      10.0.1.5

     |== connection 1 (TLS) ==>|                              |
     |                         |-- connection 2 (plain) ----->|
     |                         |                              |
     |   "from 198.51.100.7"   |    "from 10.0.0.10"          |
```

## What a reverse proxy is used for

| Job | What it means |
| --- | --- |
| TLS termination | The certificate lives on the proxy. Backends receive plain HTTP. |
| Routing | `/api` goes to one group of servers and `/images` to another. One address serves many sites by `Host`. |
| Load balancing | Requests are spread across several copies of a backend. |
| Caching | A stored copy of a response is returned without asking the backend. |
| Compression | Responses are compressed before they are sent. |
| Protection | Oversized requests, floods and slow clients are stopped before they reach the application. |

Putting these jobs in one place means the application does not need to do them, and they are done the same way for every service.

## The lost client address

Since the backend sees the proxy as its client, the real client's address is gone unless the proxy passes it on. Proxies add headers for this.

- `X-Forwarded-For` holds the client's address. Each proxy on the path adds the address it received the request from, so the header can become a list.
- `X-Forwarded-Proto` holds `https` or `http`: the scheme the client used with the proxy.
- `X-Forwarded-Host` holds the original `Host`.

```http example forwarded readonly
GET /orders HTTP/1.1
Host: shop.example.com
X-Forwarded-For: 198.51.100.7, 10.0.0.10
X-Forwarded-Proto: https
```

## Whose address is it {prediction}

An application limits each client address to 100 requests a minute. It reads the address from the TCP connection. It is then placed behind a reverse proxy with no other change.

:::question proxy-address
What happens to the limit?
- [ ] Nothing changes, since the proxy forwards the requests unchanged :: The requests are forwarded on a new connection, and that connection comes from the proxy.
- [x] All clients share one limit and are blocked together :: Every request now arrives from the proxy's address, so the application counts all users as one client.
- [ ] The limit stops working, and nobody is ever blocked :: The opposite. One address reaches the limit almost at once.
:::

## Trust only your own proxy

`X-Forwarded-For` is an ordinary header, and a client can send any value it likes. An application that believes the header from anyone lets a client claim to be any address.

The safe rule has two parts.

1. The outermost proxy that you control overwrites or appends to the header with the address it really saw.
2. The application reads the header only when the connection came from that proxy, and takes the entry that your own proxy wrote, which is the last one it added, not the first in the list.

The same care applies to `X-Forwarded-Proto`. An application that builds links or decides whether a request was secure must take that fact from its own proxy.

This is general guidance, not a statement of any organization's policy.

## The proxy's own errors

When the backend does not behave, the proxy answers the client itself.

| Status | The proxy is saying |
| --- | --- |
| `502 Bad Gateway` | I connected and got a broken answer, or the connection was refused or reset |
| `503 Service Unavailable` | I have no healthy backend to send this to |
| `504 Gateway Timeout` | I connected and waited, and no answer came before my time limit |

These codes are a gift when debugging. They say the client reached the proxy, so DNS, the public network and TLS all worked. The problem lies between the proxy and the backend, or in the backend.

A `504` often comes from mismatched time limits. If the proxy waits 30 seconds and a report takes 45 seconds to produce, the client gets a `504` while the application finishes the work and finds nobody to send it to.

## Which timeout {prediction}

A proxy has a 60 second limit for backend responses. The application has a 120 second limit for its own database queries. A slow query takes 90 seconds.

:::question mismatch
What do the client and the application each see?
- [ ] Both see success after 90 seconds :: The proxy stops waiting at 60 seconds.
- [x] The client gets a 504 at 60 seconds, and the application completes the query at 90 seconds :: The proxy gave up first. The application was within its own limit and never learned that nobody was waiting.
- [ ] Both see a failure at 60 seconds :: The proxy closes its side. The application's query keeps running unless it notices and cancels.
:::

## Exercise: put a proxy in front {independent}

An application listens on `0.0.0.0:8080` with plain HTTP and is reached directly from the internet. It logs each client's address, redirects `http` to `https` by looking at the incoming request, and has a 5 minute limit for file uploads.

You place a reverse proxy in front that terminates TLS on port 443. List what breaks or changes in the application, and what you would set on the proxy and on the application for each point.

## One possible answer {walkthrough}

1. **Logged addresses.** Every log line shows the proxy's address. Have the proxy set `X-Forwarded-For`, and have the application read it only for connections from the proxy.
2. **The redirect.** The application now receives plain HTTP for every request, so it redirects every request to `https`, which arrives again as plain HTTP. That is an endless loop. Have the proxy set `X-Forwarded-Proto` and base the redirect on it, or move the redirect to the proxy.
3. **Uploads.** The proxy has its own time limit and its own maximum body size, and both are usually far below 5 minutes and a large file. Raise them for the upload path, or uploads fail with `504` or `413`.
4. **Direct access.** Port 8080 is still open to the internet, so the proxy can be bypassed, and with it the TLS and any protection. Listen on a private interface, and allow port 8080 from the proxy only.

The fourth point is the one most often missed. A proxy protects only the traffic that has to pass through it.
