---
id: course:networking/module/tls
title: TLS and certificates
requires: []
outcomes: []
tasks: []
drills: []
---

Packets cross devices owned by many parties, and any of them can read or change plain data. TLS protects a connection against that. This module covers what TLS guarantees, how a certificate proves who the server is, and the errors you will meet.

## What TLS gives you

**TLS** (Transport Layer Security) runs between TCP and the application protocol. HTTPS is HTTP sent through TLS. It gives three guarantees.

- **Privacy.** The data is encrypted, so devices on the path see only that two addresses are talking, and how much.
- **Integrity.** If anything changes the data on the way, the receiver detects it and drops the connection.
- **Identity.** The client can check that the server really is the owner of the name it asked for.

The third is easy to overlook and matters as much as the first. Encryption alone would protect your data perfectly on its way to an impostor.

Some things stay visible. An observer still sees the server's address and port, the timing and size of the traffic, and normally the server's name, which the client sends unencrypted at the start so the server knows which site is wanted.

## Two kinds of key

TLS uses two kinds of encryption together.

- **Symmetric** encryption uses one shared key to both lock and unlock. It is fast, and it protects the actual data.
- **Asymmetric** encryption uses a pair: a **public key** that anyone may have and a **private key** that the owner never shares. What one of them does, only the other can check or undo.

The problem TLS solves at the start of every connection is this: the two sides have never met and must agree on a shared key while others may be listening. The key pair makes that possible. It is used briefly to prove identity and to agree on a fresh shared key. Everything after that uses the fast shared key.

## Certificates

A **certificate** is a signed document that says "this public key belongs to this name". It contains the names it is valid for, the public key, a start date and an end date, and the signature of whoever issued it.

The issuer is a **certificate authority** (CA): an organization that checks that the requester controls the name before it signs. Your operating system and browser ship with a list of CAs they trust, called **root certificates**.

Roots rarely sign server certificates directly. A root signs an **intermediate** certificate, and the intermediate signs the server's. This is a **chain**. The client follows it link by link until it reaches a root it already trusts.

```text example chain readonly
   +--------------------------+
   | root CA                  |   already on your machine, trusted
   +--------------------------+
                | signs
                v
   +--------------------------+
   | intermediate CA          |   sent by the server
   +--------------------------+
                | signs
                v
   +--------------------------+
   | shop.example.com         |   sent by the server
   | valid 1 Mar to 30 May    |
   | public key: ...          |
   +--------------------------+
```

## The handshake

After the TCP handshake, the TLS handshake runs. In TLS 1.3 it takes one round trip.

1. The client says which name it wants and which methods it supports, and sends its half of a key exchange.
2. The server answers with its half, its certificate chain, and a signature made with its private key.
3. The client checks the chain, the name, the dates and the signature. Both sides now compute the same shared key.

The signature is the proof of identity. Only the holder of the private key that matches the certificate could have made it.

```text example tls-handshake readonly
   client                                           server
     |--- TCP handshake (1 round trip) ---------------->|
     |                                                  |
     |--- hello: name, methods, key share ------------->|
     |<-- hello: key share, certificates, signature ----|   1 round trip
     |                                                  |
     |    client checks: chain, name, dates, signature  |
     |                                                  |
     |=== encrypted request ===========================>|
     |<== encrypted response ===========================|
```

## What the client checks

A certificate is accepted only if all four checks pass.

| Check | Fails when |
| --- | --- |
| Chain | No path leads to a trusted root, or the server did not send the intermediate |
| Name | The name the client asked for is not listed in the certificate |
| Dates | Today is before the start date or after the end date |
| Signature | The server cannot prove it holds the matching private key |

The name check uses the name in the URL, not the address. A certificate for `shop.example.com` does not cover `www.shop.example.com` or the bare address. A **wildcard** such as `*.example.com` covers one level: `shop.example.com` and not `a.shop.example.com`.

## Connecting by address {prediction}

A site at `https://shop.example.com` has a valid certificate. To skip DNS while testing, an engineer opens `https://203.0.113.10` instead, which is the same server.

:::question by-address
What does the client report?
- [ ] Nothing. It is the same server, so the same certificate is valid :: The certificate proves a name. It is the same server, and the client has no way to know that.
- [x] A certificate name mismatch :: The client asked for `203.0.113.10`, and the certificate lists only `shop.example.com`.
- [ ] An expired certificate :: The dates have nothing to do with how the server was addressed.
:::

## Expiry

Certificates expire on purpose. A short life limits the damage if a private key is stolen, and it forces the checks to be repeated. Public certificates last months, not years. The longest life that browsers accept has been shortened several times, and many certificates last 90 days or less.

An expired certificate is one of the most common causes of a sudden, complete failure. Every client refuses at the same second, and nothing in the application changed. Two habits prevent it: renew automatically, and alert well before the end date, for example at 21 days left, so a broken renewal is noticed in time.

## Where TLS ends

TLS protects one connection between two endpoints. In many systems the public connection ends at a load balancer or proxy, which decrypts the request and opens a second connection to the application. This is called **TLS termination**.

The second connection is a separate choice. It can be plain HTTP inside a private network, or TLS again. When someone says "the site uses HTTPS", it is worth asking which parts of the path that covers.

```text example termination readonly
   browser ===== TLS =====> load balancer ----- plain HTTP -----> app
                            (certificate          (inside the private
                             lives here)           network)

   browser ===== TLS =====> load balancer ===== TLS =====> app
                            (decrypts, then encrypts again)
```

## Inspect a certificate

Two tools show what a server presents. In the output, look for the names the certificate covers, its two dates, the list of certificates in the chain, and the line that reports the result of the checks.

```bash example inspect readonly
# show the chain the server sends and the result of the checks
openssl s_client -connect shop.example.com:443 -servername shop.example.com

# show the dates of the server's certificate
echo | openssl s_client -connect shop.example.com:443 \
  -servername shop.example.com 2>/dev/null | openssl x509 -noout -dates

# curl prints the handshake and the certificate's names
curl -v https://shop.example.com/ -o /dev/null
```

## Works in the browser, fails in the job {prediction}

A site loads in every browser. A script on a server that calls the same URL fails with "unable to get local issuer certificate".

:::question missing-intermediate
What is the most likely cause?
- [ ] The certificate has expired :: Browsers would refuse an expired certificate too.
- [x] The server does not send its intermediate certificate :: Browsers often have the intermediate cached or fetch it themselves. A plain client has only the roots and cannot complete the chain.
- [ ] The script uses the wrong port :: A wrong port would fail to connect before any certificate was seen.
:::

## Exercise: three reports {independent}

For each report, name which of the four checks failed and what you would do.

1. "At 02:00 every client started failing with a certificate error. Nothing was deployed."
2. "The new name `api.eu.example.com` gives a certificate error. The certificate is for `*.example.com`."
3. "A teammate fixed their script by turning certificate checking off."

## One possible answer {walkthrough}

1. **Dates.** The certificate expired at that moment. Renew it now. Then find out why the automatic renewal did not run, and add an alert that fires weeks before the end date.
2. **Name.** A wildcard covers one level. `api.eu.example.com` is two levels below `example.com`. Issue a certificate that lists that name, or one for `*.eu.example.com`.
3. **None was fixed.** Turning the check off removes the identity guarantee. The connection is still encrypted, to whoever answers. The script now accepts an impostor without complaint. Find the failing check and repair it. Most often the cause is a missing intermediate or a private CA that the machine does not have in its trusted list.

The third point is general guidance, not a statement of any organization's policy.
