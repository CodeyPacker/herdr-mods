---
id: course:networking/module/http
title: HTTP on the wire
requires: []
outcomes: []
tasks: []
drills: []
---

HTTP is the application protocol behind websites and most APIs. This module looks at what is sent over the connection: the text of a request and a response, how connections are reused, and what the newer versions changed.

## A request

An HTTP request is a message with three parts.

1. A **request line**: the method, the path and the protocol version.
2. **Headers**: one `Name: value` pair per line, with extra information.
3. An optional **body**, after an empty line.

In HTTP/1.1 these are plain text lines sent over the TCP connection. The `Host` header is required. One address often serves many sites, and `Host` tells the server which one the request is for.

```http example request readonly
POST /orders HTTP/1.1
Host: shop.example.com
Content-Type: application/json
Content-Length: 31
Accept: application/json

{"item": "kettle", "count": 2}
```

## A response

The response has the same shape. Its first line carries a **status code**, a three-digit number that says how the request went. The first digit gives the group.

| Group | Meaning | Common examples |
| --- | --- | --- |
| `2xx` | It worked | `200 OK`, `201 Created`, `204 No Content` |
| `3xx` | Look somewhere else | `301` moved for good, `304` not changed |
| `4xx` | The request was wrong | `400`, `401`, `403`, `404`, `429` |
| `5xx` | The server failed | `500`, `502`, `503`, `504` |

The split between `4xx` and `5xx` matters when you debug. A `4xx` says the client should change the request. A `5xx` says the request may have been fine and the fault is on the server side.

```http example response readonly
HTTP/1.1 201 Created
Content-Type: application/json
Content-Length: 44
Location: /orders/8841

{"id": 8841, "item": "kettle", "count": 2}
```

## How the receiver knows where a message ends

A TCP connection is a stream of bytes with no built-in message boundaries. HTTP has to say where each message stops, in one of two ways.

- `Content-Length: 44` gives the body's size in bytes. The receiver reads exactly that many.
- `Transfer-Encoding: chunked` sends the body in pieces, each with its own size in front, and a piece of size 0 at the end. It is used when the size is not known in advance, such as for a response that is produced as it is sent.

A wrong `Content-Length` breaks the connection in confusing ways. If it is too large, the receiver waits for bytes that never come. If it is too small, the leftover bytes are read as the start of the next message.

## Keeping the connection open

HTTP/1.1 keeps the TCP connection open after a response, so the next request skips the handshake. This is called **keep-alive**, and it is the default.

One limit remains. On a single HTTP/1.1 connection, requests are answered one at a time and in order. A slow response holds up every request waiting behind it. Browsers work around this by opening about six connections to each site.

```text example keepalive readonly
   without reuse                       with keep-alive

   handshake                           handshake
   request 1 / response 1              request 1 / response 1
   close                               request 2 / response 2
   handshake                           request 3 / response 3
   request 2 / response 2              ...
   close                               (closed after an idle period)
   handshake
   request 3 / response 3
   close
```

## The slow first request {prediction}

A page needs 12 small files from one server over HTTP/1.1. The browser opens 6 connections. The first file on each connection is slow to produce, about 2 seconds, and the rest take 10 ms each.

:::question head-of-line
When do the fast files start to arrive?
- [ ] At once, because they are small :: Each connection answers one request at a time. A fast file queued behind a slow one has to wait.
- [x] After about 2 seconds, once the slow responses have finished :: All six connections are busy with a slow response. The other six requests wait behind them.
- [ ] Never, because the connections are closed after one response :: Keep-alive leaves them open. The requests are delayed, not dropped.
:::

## HTTP/2 and HTTP/3

Both newer versions keep the same methods, paths, headers and status codes. What changed is how the messages are carried.

**HTTP/2** sends many requests and responses over one connection at the same time. Each belongs to a numbered **stream**, and their pieces are mixed on the wire. A slow response no longer holds up the others at the HTTP level. Headers are sent in a compressed binary form, not as text.

HTTP/2 still runs on TCP, and TCP delivers bytes in order. If one packet is lost, every stream waits until it is sent again, even streams whose data already arrived.

**HTTP/3** removes that wait by replacing TCP with **QUIC**, a protocol built on UDP. QUIC tracks each stream separately, so a lost packet delays only the stream it belonged to. It also combines the connection setup with the encryption setup, which saves a round trip.

| | HTTP/1.1 | HTTP/2 | HTTP/3 |
| --- | --- | --- | --- |
| Runs on | TCP | TCP | QUIC over UDP |
| Format | Text | Binary | Binary |
| Requests at once per connection | 1 | Many | Many |
| A lost packet delays | That connection | Every stream | One stream |

## Headers that change how the network behaves

Most headers are for the application. A few change what the network pieces in the middle do.

- `Host` selects the site on a shared address.
- `Connection: close` asks for the connection to be closed after this response.
- `Cache-Control` says whether a copy may be stored and for how long, by the browser and by caches in between.
- `Content-Encoding: gzip` says the body is compressed.
- `Retry-After` says how long to wait before asking again, on a `429` or `503`.

## Read a real exchange

`curl` prints the request it sends and the response it gets. Lines that start with `>` were sent, and lines that start with `<` were received.

```bash example curl readonly
curl -v https://shop.example.com/health

# show only the response headers
curl -sI https://shop.example.com/health

# send a body
curl -v -X POST https://shop.example.com/orders \
  -H "Content-Type: application/json" \
  -d '{"item": "kettle", "count": 2}'
```

## Who is at fault {prediction}

A client sends a request and receives `502 Bad Gateway`. The site runs behind a proxy that passes requests on to an application server.

:::question status-502
What does the status say?
- [ ] The client sent a malformed request :: That would be a `4xx` code, such as `400`.
- [ ] The application returned an error page of its own :: An error the application produced itself would normally be a `500`.
- [x] The proxy got no valid response from the server behind it :: `502` is written by the proxy. The application is down, crashed mid-response, or sent something the proxy could not read.
:::

## Exercise: read the exchange {independent}

A client sends this request and waits for 60 seconds before it gives up.

```http
POST /upload HTTP/1.1
Host: files.example.com
Content-Type: text/plain
Content-Length: 500

(the client then sends 200 bytes and stops)
```

Explain why the server never answers. Then say what the client would see if the header had read `Content-Length: 100` and it had still sent 200 bytes on a connection that is kept open.

## One possible answer {walkthrough}

The server was told to expect 500 bytes of body. It has read 200 and is waiting for the other 300 before it treats the request as complete. Nothing is wrong at the network level: the connection is open and idle. Each side is waiting for the other until a timeout ends it.

With `Content-Length: 100`, the server reads 100 bytes, treats the request as complete and answers it. The other 100 bytes stay in the stream. On a kept-open connection the server reads them as the start of a second request. They are not a valid request line, so the server answers `400 Bad Request` and usually closes the connection.

In both cases the fault is a length that does not match the body. The lesson for debugging is that a hang with no error is often one side waiting for bytes it was promised.
