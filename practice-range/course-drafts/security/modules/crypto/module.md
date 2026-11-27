---
id: course:security/module/crypto
title: Cryptography in practice
requires: []
outcomes: []
tasks: []
drills: []
---

Developers rarely need to invent cryptography, and they often need to use it. This module covers the four tools, which one fits which job, and the mistakes that make correct algorithms useless.

The advice here is general guidance, not any organization's policy.

## Four tools

Almost every use of cryptography in an application is one of four things.

| Tool | What it does | Key? | Reversible? |
| --- | --- | --- | --- |
| Hashing | Produces a fixed-size fingerprint of data | No | No |
| Message authentication (MAC) | Proves data was made by someone who holds a key | One shared key | No |
| Encryption | Hides data from anyone without the key | One key, or a pair | Yes |
| Digital signature | Proves who made the data, checkable by anyone | A key pair | No |

Choosing the wrong one is the commonest mistake. People encrypt when they need a signature, or hash when they need a MAC. Start from the question: do I need to hide this, or to prove it has not been changed, or to prove who sent it?

## Hashing

A **hash function** turns data of any size into a short fixed-size value. The same input always gives the same output. Changing one bit of the input changes the output completely. There is no practical way to go backwards or to find two inputs with the same hash.

Use it for integrity: checking that a downloaded file is the file that was published, identifying content, detecting change.

SHA-256 and the SHA-3 family are current choices. MD5 and SHA-1 are broken for security purposes, since two different inputs with the same hash can be constructed, and should not be used for anything that an attacker might influence.

A plain hash has no key, so it proves nothing about who made it. Anyone can change the data and compute a new hash. And as the passwords module showed, a fast hash is the wrong tool for storing passwords.

## Message authentication

A **MAC** (message authentication code) is a fingerprint made from the data and a secret key together. Only someone who holds the key can produce the right value, and only someone who holds the key can check it. **HMAC** is the standard construction, as in HMAC-SHA-256.

Use it when the same party, or two parties who share a key, need to know that data was not changed in between.

- A webhook: the sender computes an HMAC of the body with a shared secret and puts it in a header. The receiver computes it again and compares. A forged or altered request does not match.
- A signed cookie or a token that the server gives to a client and later gets back.

Compare MAC values with a constant-time comparison, as with any secret.

```text example hmac readonly
   SENDER (has the shared secret)          RECEIVER (has the same secret)

   body + secret --> HMAC = 9f2c...        body + secret --> HMAC = 9f2c...
   send: body, and the HMAC in a header    compare with the header
                                           equal?  accept
                                           differ? reject: changed or forged
```

## Symmetric encryption

**Symmetric encryption** uses one key to both encrypt and decrypt. It is fast and is what protects data in bulk: files, database fields, the contents of a TLS connection.

The current standard is **AES**. The algorithm alone is not the whole choice. It is used in a **mode**, and the mode matters a great deal.

Use an **authenticated encryption** mode, such as AES-GCM or ChaCha20-Poly1305. It encrypts and also produces a tag that detects any change to the encrypted data. Without that, an attacker who cannot read the data may still be able to alter it in useful ways, and the decryption will not notice.

Each encryption also needs a **nonce** (also called an IV): a value that must be different every time the same key is used. Reusing a nonce with the same key can destroy the protection completely. A good library generates it for you.

## Asymmetric encryption and signatures

**Asymmetric cryptography** uses a pair of keys. The **public key** can be given to anyone. The **private key** is kept by its owner.

It solves two problems that a shared key cannot.

- **Encryption to someone you have never met.** Anyone can encrypt with the public key. Only the holder of the private key can decrypt.
- **Digital signatures.** The owner signs with the private key. Anyone can verify with the public key. A valid signature proves the data came from the holder of the private key and has not changed.

A signature differs from a MAC in who can check it. A MAC needs the secret key to verify, so anyone who can verify can also forge. A signature is verified with the public key, which cannot create signatures. That is why software updates, certificates and tokens checked by many services use signatures.

Asymmetric operations are slow, so in practice they are combined with symmetric ones. TLS uses the key pair to establish identity and agree on a fresh symmetric key, and then uses that key for the data.

```text example sign readonly
   SIGNING                                VERIFYING

   data + PRIVATE key --> signature       data + signature + PUBLIC key
                                               --> valid or not valid

   only the owner can sign                anyone can check

   compare with a MAC: there, whoever can check can also forge
```

## Which tool {prediction}

A payment provider sends your server a webhook that says "payment 8841 succeeded". You and the provider share a secret that was set up in advance. You need to be sure the message really came from the provider and was not altered.

:::question which-tool
Which tool fits?
- [ ] A SHA-256 hash of the body, sent in a header :: Anyone can compute a plain hash. An attacker would send a false body with its own correct hash.
- [x] An HMAC of the body, made with the shared secret :: Only someone who holds the secret can produce the right value. Your server computes it again and compares.
- [ ] Encrypting the body with the shared secret :: Hiding the content is not the requirement. Proving its origin and integrity is. Encryption without authentication does not even do that.
:::

## Do not write your own

The rule everyone repeats is true: do not design your own cryptography, and do not implement standard algorithms yourself.

The reasons are practical. A homemade scheme has been examined by one person. Standard ones have been attacked by experts for years. Even a correct algorithm implemented by hand tends to leak through timing, poor randomness or mishandled edge cases, none of which show up in tests, since a broken cipher still encrypts and decrypts.

The rule extends to combining pieces. Choosing a cipher, a mode, a padding and a MAC and wiring them together is designing a scheme.

So work at the highest level you can.

- Use TLS for data in transit, with the library's defaults.
- Use the storage encryption that your database or cloud platform provides.
- When you must encrypt in code, use a library that offers one "encrypt this with this key" function, which chooses sound primitives and handles the nonce.

## Randomness

Keys, tokens, session IDs, nonces and reset links all depend on values that cannot be predicted.

Ordinary random functions in programming languages are built for simulations and games. Their output looks random and can be predicted by someone who sees a few values. Using one for a session ID or a reset token makes those guessable.

Use the **cryptographically secure random generator** that your platform provides, which draws on the operating system. Every language has one, usually in a module with "secure", "secrets" or "crypto" in its name.

Never derive a secret from the time, a counter, a user ID or a hash of those. A hash of a predictable value is a predictable value.

## Keys are the hard part

A sound algorithm with a badly kept key protects nothing. Most real failures of encryption are failures of **key management**.

- **Keep keys apart from the data.** A key stored in the same database as the data it protects is taken in the same theft.
- **Never put keys in source code** or in a repository. The next module covers this.
- **Use a key management service** (KMS) or a secrets manager. The key stays inside the service, which performs operations with it and records every use.
- **Rotate keys.** Change them on a schedule and at once after any suspected leak. The design must allow that: store which key version encrypted each item.
- **Limit who and what can use each key**, and log every use.

A useful pattern is **envelope encryption**. Each item is encrypted with its own data key. The data key is encrypted with a master key that never leaves the KMS, and is stored beside the item. Rotating the master key then means re-encrypting small data keys, not all the data.

## In transit and at rest

Data needs protecting in two states.

**In transit**, moving over a network. Use TLS everywhere, including between your own services inside a private network. Do not disable certificate checking to make an error go away.

**At rest**, stored on a disk. Turn on the storage encryption of your database, disks, backups and object storage. It protects against a stolen disk or a mishandled backup.

Know the limit of encryption at rest. It is transparent to anything that reads through the database. An attacker who gets in through SQL injection, or with a stolen application credential, receives the data decrypted like any other reader. For the most sensitive fields, such as identity numbers, add encryption in the application, so that the database itself holds only encrypted values.

## Encoding is not encryption

Three things are often confused.

- **Encoding** (Base64, hex, URL encoding) changes how data is written. It needs no key and anyone can reverse it. It protects nothing.
- **Hashing** is one way and has no key.
- **Encryption** is reversible with a key.

A password stored as Base64 is stored in plain text. A JWT payload is Base64 and readable by anyone. If no key is needed to read a value, the value is not protected.

## Encrypted at rest {prediction}

A company's database is encrypted at rest with a key held in a key management service. An attacker exploits a SQL injection flaw in the web application and runs `SELECT * FROM customers`.

:::question at-rest
What does the attacker receive?
- [ ] Encrypted data they cannot read :: Encryption at rest protects the files on disk. This query goes through the database, which decrypts for every reader.
- [x] The customer rows, readable :: The database decrypts data for any query run by an authorised connection, and the application's connection is authorised. Encryption at rest does not help against attacks that come through the application.
- [ ] Nothing, since the key is in a separate service :: The database already has use of the key. That is how it serves the application.
:::

## Exercise: choose the tool {independent}

For each need, choose hashing, a MAC, symmetric encryption, a signature, or none of them, and say why. Name the specific pitfall to avoid.

1. Store users' national identity numbers so that support staff with database access cannot read them.
2. Let customers verify that a software update they downloaded really came from your company.
3. Produce a password reset token.
4. Make sure a "price" value that you send to the browser in a hidden field comes back unchanged.
5. Store API keys that you issue to customers.
6. "Protect" a user ID in a URL by Base64-encoding it.

## One possible answer {walkthrough}

1. **Symmetric encryption in the application**, with an authenticated mode and a key in a KMS that the database and support staff cannot use. Storage encryption alone would not do it, since staff querying the database would see the values decrypted. Pitfall: keeping the key in the same database.
2. **A digital signature.** You sign each release with a private key, and customers verify with your public key. A MAC would require giving customers the secret, and then any customer could forge an update. Pitfall: the private signing key must be guarded more closely than almost anything else you hold.
3. **None of the four. It needs secure randomness.** Generate at least 128 random bits from the secure generator. Store a hash of the token and compare hashes. Pitfall: an ordinary random function, or a value derived from the time.
4. **A MAC**, if the value must travel through the browser. Better: do not send it at all. Keep the price on the server and look it up. Pitfall: believing that encrypting the field, or hiding it, prevents changes.
5. **A fast hash** (SHA-256) of each key, with the key shown to the customer once. The keys are long and random, so they cannot be guessed, and a slow password hash would only delay every API call. Pitfall: storing them in readable form, so that a database copy is a list of working keys.
6. **Nothing is protected.** Base64 is encoding. Anyone decodes it in a second. If the aim is to stop people reading other users' records, the answer is an authorization check on the server.

Half of these turn out to need no encryption. Deciding what the actual requirement is comes before choosing any algorithm.
