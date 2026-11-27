---
id: course:networking/module/addresses
title: IP addresses and subnets
requires: []
outcomes: []
tasks: []
drills: []
---

Every packet names the machine it is going to with an IP address. This module covers how to read an address, which addresses are private, and how a range of addresses is written.

## An IPv4 address

An **IPv4 address** is a 32-bit number. It is written as four numbers from 0 to 255 with dots between them, such as `203.0.113.10`. Each of the four numbers is one byte.

There are about 4.3 billion possible IPv4 addresses, which is fewer than the number of devices in use. Two things make up for that. Private addresses are reused inside every home and office, as this module shows. **IPv6** is a newer format with 128-bit addresses, written in hexadecimal groups such as `2001:db8::10`. Both are in use today, and the ideas in this course apply to both. The examples use IPv4 because it is shorter to read.

```text example address readonly
      203   .    0    .   113   .   10
   11001011 . 00000000 . 01110001 . 00001010

   four bytes, 32 bits in total
```

## A machine can have several addresses

An address belongs to a **network interface**, not to a machine. An interface is one connection to a network: a Wi-Fi card, a cable port, or a virtual one made by software. A laptop on Wi-Fi with a VPN running has at least three interfaces, each with its own address.

One interface exists on every machine. The **loopback** interface has the address `127.0.0.1` and the name `localhost`. A packet sent to it never leaves the machine. It is how a program talks to another program on the same machine.

```text example interfaces readonly
   one laptop

   +--------------+----------------+--------------------------------+
   | interface    | address        | reaches                        |
   +--------------+----------------+--------------------------------+
   | loopback     | 127.0.0.1      | this machine only              |
   | Wi-Fi        | 192.168.1.23   | the home network, then onward  |
   | VPN          | 10.8.0.5       | the office network             |
   +--------------+----------------+--------------------------------+
```

## Private and public addresses

Three ranges of IPv4 addresses are reserved as **private**. Anyone may use them inside their own network, and routers on the public internet refuse to carry packets addressed to them.

| Range | Usual sight |
| --- | --- |
| `10.0.0.0` to `10.255.255.255` | Company and cloud networks |
| `172.16.0.0` to `172.31.255.255` | Cloud networks, container networks |
| `192.168.0.0` to `192.168.255.255` | Home routers |

Every other address is **public**: it is unique on the internet and reachable from anywhere, unless a firewall blocks it.

Since private addresses are reused everywhere, `192.168.1.23` in your home and `192.168.1.23` in a neighbour's home are different machines. A private address means something only inside its own network.

## Which one can be reached {prediction}

A colleague in another city sends you this: "My test server is running, open `http://192.168.0.14:8080`."

:::question private-reach
What happens when you open it from your own home?
- [ ] It reaches the colleague's server, because the address is exact :: The address is exact only inside their network. Private ranges are reused in every network.
- [x] It goes to whatever has that address on your own network, or to nothing :: The address is private, so your router keeps the packet inside your own network.
- [ ] The internet routes it to the nearest machine with that address :: Internet routers drop packets addressed to private ranges.
:::

## Writing a range of addresses

A **subnet** is a block of addresses that share their first bits. It is written in **CIDR notation**: an address, a slash, and the number of leading bits that are fixed.

`10.0.1.0/24` means the first 24 bits are fixed and the last 8 are free. It covers `10.0.1.0` to `10.0.1.255`, which is 256 addresses.

A smaller number after the slash means a larger block, because fewer bits are fixed. Each bit you free doubles the size.

| CIDR | Fixed part | Addresses |
| --- | --- | --- |
| `10.0.0.0/8` | `10.` | 16,777,216 |
| `10.0.0.0/16` | `10.0.` | 65,536 |
| `10.0.1.0/24` | `10.0.1.` | 256 |
| `10.0.1.16/28` | first 28 bits | 16 |
| `10.0.1.5/32` | all of it | 1 |

Two special forms are worth knowing by sight. `/32` is exactly one address. `0.0.0.0/0` fixes no bits, so it means every address there is.

```text example cidr readonly
   10.0.1.0/24

   10       . 0        . 1        . 0
   00001010 . 00000000 . 00000001 . 00000000
   |<------- 24 fixed bits ------>| |<- 8 ->|
                                     free

   covers 10.0.1.0 through 10.0.1.255   (2 to the power 8 = 256)
```

## Is it in the range {prediction}

A firewall rule allows traffic from `10.0.4.0/22`. The fixed part is 22 bits, so the last 2 bits of the third number and all of the fourth are free. The third number can be 4, 5, 6 or 7.

:::question in-range
Which address does the rule allow?
- [ ] `10.0.3.200` :: The third number is 3, which is below the block. The block starts at 10.0.4.0.
- [x] `10.0.6.17` :: The third number 6 lies between 4 and 7, so the address is inside the block.
- [ ] `10.0.8.1` :: The block ends at 10.0.7.255. The third number 8 is one past it.
:::

## Where subnets are used

You will write CIDR ranges in three places.

- **Network layout.** A cloud network is given a large block such as `10.0.0.0/16` and cut into smaller subnets, for example one for web servers and one for databases.
- **Firewall rules.** A rule says which source range may reach a port.
- **Routing.** A route says which range is reached through which neighbour.

Two subnets that you connect must not overlap. If the office uses `10.0.0.0/16` and the cloud network also uses `10.0.0.0/16`, a machine cannot tell which side an address belongs to. Choose ranges with this in mind before the networks are joined, because changing them later means changing every machine's address.

## Exercise: plan the ranges {independent}

A team has the block `10.20.0.0/16` for a new system. It needs three subnets:

- web servers, up to 200 machines
- databases, up to 10 machines
- a management subnet for at most 5 machines

Write a CIDR range for each. Then answer: the company's office network is `10.20.0.0/16` as well. What will go wrong when the two are connected, and what would you change?

## One possible answer {walkthrough}

| Subnet | Range | Size |
| --- | --- | --- |
| Web | `10.20.1.0/24` | 256 |
| Databases | `10.20.2.0/28` | 16 |
| Management | `10.20.3.0/28` | 16 |

A `/24` holds 256 addresses, which covers 200 machines. A `/28` holds 16, which covers 10 and 5. Cloud providers reserve a few addresses in each subnet for their own use, so a `/29` with 8 addresses would be too tight for 5 machines. Many teams would use a `/24` for all three, because private addresses cost nothing and a subnet that is too small is painful to grow.

The overlap is the real problem. With the same `/16` on both sides, an office machine sending to `10.20.1.15` cannot know whether that is a neighbour in the office or a web server in the cloud. The fix is to give the new system a block the office does not use, such as `10.21.0.0/16`, before anything is built in it.
