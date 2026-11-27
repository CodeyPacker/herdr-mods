---
id: course:networking/module/balancing
title: Load balancers
requires: []
outcomes: []
tasks: []
drills: []
---

One server is a limit on how much work can be done and a single thing that can fail. A load balancer puts several servers behind one address. This module covers how it chooses a server, how it knows which servers work, and how to take one out without dropping requests.

## What a load balancer does

A **load balancer** receives traffic at one address and spreads it across a group of servers that all do the same job. The group is often called a **pool**, and its members are **backends** or **targets**.

It gives you two things.

- **Capacity.** Three servers handle about three times the traffic of one.
- **Availability.** When one server fails, the others keep answering, and clients need not notice.

Both depend on the servers being interchangeable. If a request can be answered correctly by only one particular server, the load balancer cannot help with it. That is the subject of the section on sessions below.

```text example pool readonly
                              +--> server A   healthy
   clients --> load balancer -+--> server B   healthy
               203.0.113.10   +--> server C   failed, no traffic sent
```

## Layer 4 and layer 7

Load balancers come in two kinds, named for the layer they work at.

A **layer 4** load balancer works with TCP connections. It chooses a server when a connection opens and passes every byte of that connection to the same server. It does not read the content, so it is fast and works for any protocol, including databases.

A **layer 7** load balancer understands HTTP. It reads each request and can choose a server per request, by path, by `Host` or by header. It can terminate TLS, add headers, retry a failed request and answer with its own error pages. It is a reverse proxy with a pool.

| | Layer 4 | Layer 7 |
| --- | --- | --- |
| Unit it balances | Connections | Requests |
| Reads the request | No | Yes |
| Routes by path or host | No | Yes |
| Terminates TLS | Usually not | Usually |
| Works for non-HTTP traffic | Yes | No |

The difference matters with long-lived connections. One client that keeps a single connection open and sends a thousand requests on it puts all thousand on one server behind a layer 4 balancer.

## How a server is chosen

- **Round robin.** Each server in turn. Simple, and fair when requests cost about the same.
- **Least connections.** The server with the fewest requests in progress. Better when some requests are much slower than others, since a server stuck with slow ones gets fewer new ones.
- **Weighted.** A server with twice the weight gets twice the share. Used when machines differ in size, or to send a small share of traffic to a new version.
- **Hash.** A value from the request, such as the client address or a user ID, decides the server, so the same value always lands on the same one.

## Slow requests {prediction}

A pool of two servers uses round robin. One request in ten is a report that takes 30 seconds. The rest take 50 ms. By chance, several reports in a row land on server A.

:::question algorithm
What does round robin do next?
- [ ] It sends new requests to server B until A catches up :: Round robin does not look at how busy a server is.
- [x] It keeps sending every second request to server A :: The turn order is fixed. A becomes overloaded while B is idle half the time. Least connections would avoid this.
- [ ] It removes server A from the pool :: Only a failed health check removes a server. A is slow and still healthy.
:::

## Health checks

A load balancer has to know which servers can take traffic. It asks each one at a fixed interval, for example every 10 seconds. This is a **health check**. A server that fails several checks in a row is taken out of the pool. When it passes several in a row, it is put back.

For HTTP, the check is a request to a path the application provides for this purpose, such as `/health`, and anything other than a `200` counts as a failure.

What that path does is a design decision.

- A check that only proves the process is running stays green while the application cannot reach its database.
- A check that tests every dependency turns every server red at once when one shared dependency has a brief problem, and the load balancer then has nowhere to send anything.

A good check answers one question: can **this** server do useful work now? It tests what is specific to this server, and it is cheap, because it runs many times a minute.

```text example health readonly
   every 10 s:  GET /health

   server A   200  200  200  200     in the pool
   server B   200  500  500  500     3 failures in a row: taken out
   server C   200  200  200  200     in the pool

   server B   500  200  200  200     3 passes in a row: put back
```

## Sessions and sticky routing

Suppose a server keeps a user's shopping cart in its own memory. The next request from that user may land on a different server, which has no cart. This is the main obstacle to load balancing.

There are two ways out.

- **Sticky sessions.** The load balancer sends each user to the same server every time, using a cookie or a hash of the address. It works, with costs: load becomes uneven, and when a server fails or is replaced, its users lose their state.
- **Stateless servers.** No server keeps anything between requests. The cart lives in a database or a shared cache that every server can reach. Any server can answer any request.

Stateless servers are the better design. Every later topic, from deploys to scaling, becomes easier when any server can be removed at any moment.

## Taking a server out

Removing a server while it is answering requests cuts those requests off. To avoid that, a load balancer **drains** it: it stops sending new requests and lets the ones in progress finish, up to a time limit. Only then is the server stopped.

The same applies when a server starts. It should receive traffic only after its health check passes, or the first users get errors from an application that is still loading.

A deploy that replaces servers one at a time relies on both: drain the old one, start the new one, wait for healthy, move on.

```text example drain readonly
   1. mark server B as draining       no new requests to B
   2. wait for B's requests to end    up to the drain limit, e.g. 30 s
   3. stop B, start the new B
   4. health check passes             B gets traffic again
   5. repeat for the next server
```

## The balancer can fail too

A single load balancer is itself a single point of failure. Managed cloud load balancers run as several copies across separate locations and hide that from you. If you run your own, you need at least two, with a way for one to take over the other's address.

Separate locations matter for the backends as well. Three servers in one data centre all stop when that data centre has a power failure. Spreading them across independent locations, which cloud providers call zones, means one such event removes a third of the capacity and not all of it.

## Which design {prediction}

A team deploys by stopping the old servers and starting new ones, one at a time, behind a load balancer. During every deploy a few users see `502` errors.

:::question drain
What is the most likely missing piece?
- [ ] More servers in the pool :: More servers lower the share of affected requests. The requests on the stopped server are still cut off.
- [ ] A longer health check interval :: A longer interval makes the load balancer slower to notice that a server has gone.
- [x] Draining before each server is stopped :: Without it, the server is stopped while requests are in progress and while the load balancer still sends it new ones.
:::

## Exercise: design the health check {independent}

An API needs a database for every request, and it calls an external address-lookup service for about 5% of requests. Three copies run behind a layer 7 load balancer.

Decide what `/health` should check. Say what happens with your design in each case: one server loses its database connections, the database itself is down, and the lookup service is down.

## One possible answer {walkthrough}

`/health` checks that the process is running and that **this** server can reach the database, with a cheap query and a short time limit. It does not call the lookup service.

| Case | Result |
| --- | --- |
| One server loses its database connections | Its check fails. It is taken out, the other two carry the traffic, and users see nothing. This is the case the check exists for. |
| The database is down | All three fail. The load balancer returns `503`. That is honest, since no server could answer anyway. Some balancers keep sending traffic when every target fails, which gives the same outcome. |
| The lookup service is down | The check stays green. 95% of requests work, and the 5% that need a lookup get a clear error from the application. |

Including the lookup service in the check would turn a partial failure into a complete one: every server would be taken out, and the 95% of requests that never needed it would fail too.

The rule is to check what makes this one server unable to work, and to leave shared, optional dependencies out.
