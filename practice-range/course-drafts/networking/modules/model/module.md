---
id: course:networking/module/model
title: How data crosses a network
requires: []
outcomes: []
tasks: []
drills: []
---

Two programs on different machines talk by sending small pieces of data across a chain of devices. This module gives you the picture that the rest of the course fills in: packets, layers, and who starts a conversation.

## Client and server

A **server** is a program that waits for someone to contact it. A **client** is a program that starts the contact. The words describe roles in one conversation, not kinds of machine. Your laptop is a client when its browser loads a page, and a server when you run a development web server on it.

Every conversation in this course has the same outline:

1. The client finds the server's address.
2. The client opens a connection to that address.
3. The client sends a request.
4. The server sends a response.

When something fails, the first useful question is which of these four steps failed.

```text example roles readonly
   CLIENT                                         SERVER
   (starts the contact)                           (waits for contact)

   1. find the address     "shop.example.com is 203.0.113.10"
   2. open a connection    ------------------------------------>
   3. send a request       ---- "GET /cart" ------------------->
   4. receive a response   <--- "200 OK, here is the cart" -----
```

## Packets

A network does not carry a whole file or a whole web page in one piece. The sender cuts the data into **packets**, each a few hundred to about 1,500 bytes. Every packet carries the address it is going to and the address it came from, like an envelope.

Packets travel separately. Two packets from the same message can take different routes, arrive out of order, or not arrive at all. The network itself makes one promise only: it will try to deliver each packet. Putting the pieces back in order, and asking again for a missing one, is the job of software at the two ends.

```text example packets readonly
   message: "the whole web page"  (40,000 bytes)

   sender cuts it up:

   +------------------+ +------------------+ +------------------+
   | to:   203.0.113.10| | to:   203.0.113.10| | to:   203.0.113.10|
   | from: 198.51.100.7| | from: 198.51.100.7| | from: 198.51.100.7|
   | part 1 of 28     | | part 2 of 28     | | part 3 of 28     | ...
   +------------------+ +------------------+ +------------------+

   Each packet travels on its own. The receiver puts them in order.
```

## Hops

Between the client and the server sit **routers**. A router is a device that receives a packet, reads the destination address, and passes the packet to the next router that is closer to that address. Each pass from one device to the next is a **hop**.

A request to a server in another country often crosses 10 to 20 hops. No single router knows the full path. Each one only knows which neighbour to hand the packet to next.

```text example hops readonly
   laptop -> home router -> provider -> ... -> data centre -> server
            hop 1          hop 2        hops 3 to 11          hop 12

   Each router reads the "to" address and picks the next neighbour.
   None of them knows the whole path.
```

## One lost packet {prediction}

A client sends a message that is cut into 28 packets. Packet 9 is dropped by an overloaded router on the way.

:::question lost-packet
What does the network itself do about packet 9?
- [ ] It sends packet 9 again from the router that dropped it :: A router keeps no copy of a packet after it passes it on or drops it.
- [x] Nothing. Software at the two ends has to notice and send it again :: The network only tries to deliver. Noticing a gap and resending is done by the endpoints, usually by TCP.
- [ ] It tells the sender to start the whole message again :: Nothing in the network tracks whole messages. Only single packets exist there.
:::

## Layers

Network software is built in **layers**. Each layer does one job and relies on the layer below it.

| Layer | Its job | Example |
| --- | --- | --- |
| Application | What the two programs say to each other | HTTP, DNS |
| Transport | Deliver a stream of data to the right program | TCP, UDP |
| Network | Move one packet to the right machine | IP |
| Link | Move a packet across one cable or radio link | Ethernet, Wi-Fi |

The layers wrap each other. An HTTP request is placed inside a TCP segment, which is placed inside an IP packet, which is placed inside a Wi-Fi frame. The receiving side unwraps them in the opposite order.

You will see other layer lists with seven numbered layers (the OSI model). People still use two of its numbers in daily speech: "layer 4" means transport and "layer 7" means application.

```text example layers readonly
   +-----------------------------------------------------------+
   | Wi-Fi frame      (gets it across this one radio link)     |
   |  +-----------------------------------------------------+  |
   |  | IP packet     (to 203.0.113.10, from 198.51.100.7)  |  |
   |  |  +-----------------------------------------------+  |  |
   |  |  | TCP segment  (to port 443, part 3)            |  |  |
   |  |  |  +-----------------------------------------+  |  |  |
   |  |  |  | HTTP request  "GET /cart"               |  |  |  |
   |  |  |  +-----------------------------------------+  |  |  |
   |  |  +-----------------------------------------------+  |  |
   |  +-----------------------------------------------------+  |
   +-----------------------------------------------------------+
```

## Why layers help you debug

Each layer can fail on its own, and each failure looks different. A cable that is unplugged is a link problem. A wrong address is a network problem. A program that is not running is a transport problem, because nothing accepts the connection. A page that returns an error is an application problem.

Work from the bottom up. If a lower layer is broken, nothing above it can work, so testing the upper layer first tells you little.

## Which layer {prediction}

A browser shows the message "404 Not Found" for one page on a site. Other pages on the same site load.

:::question which-layer
Which layer is the problem in?
- [ ] Link, because the page did not arrive :: A response did arrive. "404" is text the server sent back.
- [ ] Transport, because the connection failed :: The connection worked. The server received the request and answered it.
- [x] Application, because the server answered and said the page does not exist :: Every lower layer did its job. The server's own program decided there is no such page.
:::

## Exercise: name the step {independent}

For each report, write which of the four steps from the first section failed: find the address, open a connection, send a request, or receive a response. Write one sentence of reasoning for each.

1. "The browser says the site's name could not be found."
2. "The page loads for 30 seconds and then says the connection timed out. The name is correct."
3. "The page loads at once and says 500 Internal Server Error."
4. "The download starts and stops halfway, every time."

## One possible answer {walkthrough}

1. **Find the address.** The name could not be turned into an address, so nothing was ever sent to the server.
2. **Open a connection.** The address was found, and nothing answered at it. No request could be sent yet.
3. **Receive a response.** The connection opened, the request arrived, and the server answered with an error of its own. The network did its job.
4. **Receive a response.** The request arrived and the response began. Something interrupts the stream of packets partway, such as a timeout on a device in the middle.

Reports 3 and 4 fail in the same step for different reasons. The later modules give you the tools to tell them apart.
