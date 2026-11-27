---
id: course:security/module/authentication
title: Authentication
requires: []
outcomes: []
tasks: []
drills: []
---

Authentication is how a system decides who is making a request. Every other control depends on it. This module covers the ways to prove identity, how login is attacked, and how to build the flows around it.

The advice here is general guidance, not any organization's policy.

## Authentication and authorization

Two words sound alike and mean different things.

- **Authentication** answers "who are you?" It establishes an identity.
- **Authorization** answers "what are you allowed to do?" It checks that identity against a rule.

A system needs both, and they fail in different ways. Weak authentication lets an attacker become someone else. Weak authorization lets a properly logged-in user reach things that are not theirs. This module is about the first. A later one covers the second.

## Factors

Identity is proven with one or more **factors**, of three kinds.

| Factor | What it is | Examples |
| --- | --- | --- |
| Something you know | A secret in your head | Password, PIN |
| Something you have | An object in your possession | Phone with an authenticator app, security key |
| Something you are | A feature of your body | Fingerprint, face |

**Multi-factor authentication** (MFA) asks for two of different kinds. Its strength comes from the difference. Someone who has stolen a password from a breach on another site does not also have the victim's phone.

Two passwords are not two factors. A password and a "secret question" are both things you know.

## How passwords fail

Passwords are the most common factor and the weakest. The attacks on them rarely involve guessing at random.

- **Credential stuffing.** People reuse passwords. When one site is breached, the leaked email and password pairs are tried on every other site automatically. This is the largest source of account takeover.
- **Password spraying.** One common password, such as `Winter2025!`, is tried against many accounts. It stays under per-account lockout limits.
- **Phishing.** The user is tricked into typing the password into a false copy of the site.
- **Brute force.** Many passwords are tried against one account. It works only when nothing limits the attempts.

Three of these four succeed however complex the password is. A long, unique password that has been phished is as lost as a short one.

## A sensible password policy

Older advice asked for symbols, digits and a change every 90 days. It produced passwords like `Password1!` followed by `Password2!`. Current guidance, such as that from NIST, is simpler and works better.

- **Length matters most.** Require a reasonable minimum, such as 12 characters, and allow long passphrases. Do not set a low maximum.
- **Check against known breached and common passwords**, and refuse those.
- **Do not force regular changes.** Require a change when there is evidence of compromise.
- **Do not impose composition rules** such as "one symbol and one digit".
- **Allow pasting**, so that password managers work. A manager gives each site a long random password, which defeats credential stuffing.

## Limit the attempts

A login endpoint with no limit can be tried millions of times.

- **Rate limit** by account and by client address. A handful of failures should slow further attempts sharply.
- **Delay, do not lock for ever.** A hard lockout after five failures lets anyone lock a victim out by guessing wrong on purpose. Growing delays, or a temporary lock, avoid that.
- **Watch for the pattern across accounts.** Spraying and stuffing show up as many accounts failing from few sources, not as one account failing many times.
- **Tell the user.** A notice of a new login from an unfamiliar device lets the real owner react.

## Multi-factor authentication

MFA is the most effective single defence against account takeover. A stolen or reused password is no longer enough. The kinds differ a great deal in strength.

| Method | Strength | Weakness |
| --- | --- | --- |
| Code sent by SMS | Better than nothing | Phone numbers can be taken over. Codes can be phished |
| Code from an authenticator app (TOTP) | Good | The code can still be phished and replayed within seconds |
| Push approval on a phone | Good | Users approve prompts they did not start, when sent many |
| Security key or passkey (WebAuthn) | Strongest | Needs device support and a recovery plan |

A security key or **passkey** is different in kind from the others. The device holds a private key and signs a challenge, and the signature is bound to the real site's address. A false site at another address gets a signature that is useless on the real one. That is why this method resists phishing and the code-based ones do not.

Offer the strongest method you can, and require MFA for administrators and for any account that can do serious harm.

```text example mfa readonly
   password only

   attacker has the password  ------------------------->  in

   password + second factor

   attacker has the password  --->  asked for the code
                                    or the key, which is
                                    on the victim's device  --->  stopped
```

## Which protects {prediction}

A user's password for a shop is the same one they used on a forum that was breached last year. The shop requires a code from an authenticator app at login.

:::question stuffing
What happens when an attacker tries the leaked password on the shop?
- [ ] They get in, since the password is correct :: The password is only the first factor.
- [x] The password is accepted, and they are stopped at the code, which they do not have :: This is what MFA is for. The reused password alone no longer opens the account. The shop should also tell the user, since a correct password from a stranger means it has leaked.
- [ ] The shop rejects the password, since it appeared in a breach :: Only if the shop checks passwords against breach lists at login, which was not stated.
:::

## Do not reveal who has an account

A login form that says "no account with that email" for one input and "wrong password" for another tells anyone which emails are registered. That is **user enumeration**. It gives an attacker a list of real accounts to target, and on some sites the mere fact of having an account is private.

Give the same answer in both cases: "email or password is incorrect". Apply the same care to every place that could leak the fact:

- the registration form ("this email is already in use"),
- the password reset form,
- the time taken to respond, which can differ when the account exists.

For registration and reset, the usual answer is to always say "if that address has an account, we have sent an email", and to put the real information in the email.

## Password reset is a second login

A reset flow lets someone into an account without the password. It is therefore exactly as sensitive as login, and it is attacked more often, since it is usually built with less care.

A sound reset flow:

1. The user asks for a reset. The response is the same whether or not the account exists.
2. The server creates a **token**: long, random and unguessable. It stores a hash of it, with an expiry time of an hour or less.
3. The token is sent in a link to the address on file.
4. Opening the link allows one password change. The token is then deleted, and so are all other reset tokens for the account.
5. All existing sessions for the account are ended, and the user is told by email that the password changed.

Faults to avoid: tokens that can be guessed or that never expire, tokens that work more than once, security questions (the answers are often public), and emailing the old or a new password in plain text.

```text example reset readonly
   1. request reset         same reply whether the account exists or not
   2. create token          random, long, stored as a hash, expires soon
   3. email the link        to the address already on file
   4. set new password      token works once, then is deleted
   5. clean up              end all sessions, notify the owner
```

## Do not build what you can borrow

Authentication has many details, and a mistake in any one opens accounts. Where you can, use something built and tested by specialists.

- **A well-used library or framework feature** for login, sessions and password storage.
- **Single sign-on** (SSO) through an identity provider, using a standard such as OpenID Connect. Your application never sees a password. It receives a signed statement of who the user is. One strong login, with MFA, then covers many applications, and removing a person's access happens in one place.

When you use these, the remaining work is to use them correctly: validate what the provider sends, and keep the library updated.

## Re-authenticate for sensitive actions

A logged-in session can be left open on a shared computer or taken over. For actions with serious consequences, ask the user to prove their identity again at that moment: changing the email or password, adding a payment method, exporting all data, deleting the account.

Changing the email address deserves particular care. It is the reset channel. Whoever controls it controls the account. Ask for the password, notify the old address, and consider a delay before the change takes effect.

## The reset link {prediction}

A site's password reset link looks like `https://app.example.com/reset?user=5521&t=1741096931`, where `t` is the time the reset was requested, in seconds. The link never expires.

:::question reset-token
What is wrong?
- [ ] Nothing, as long as the link is sent only by email :: An attacker does not need the email. They can construct the link.
- [x] The "token" can be guessed, so anyone can reset any account :: A user ID and a timestamp are both predictable. Request a reset for the victim, try the timestamps of that minute, and one works. A token must be long and random, expire quickly and work once.
- [ ] Only that it does not expire :: That is one fault. Being guessable is the worse one.
:::

## Exercise: review the login {independent}

A web application's account system works like this.

1. Passwords must be 8 characters with a digit and a symbol, and must be changed every 60 days.
2. Login shows "unknown email" or "wrong password".
3. After 5 failures an account is locked until an administrator unlocks it.
4. MFA by SMS is optional and switched off by default, including for administrators.
5. Password reset asks "What was your first pet's name?" and, on a correct answer, shows a new password on the screen.
6. Changing the account's email address needs no confirmation.

List the problem with each and what you would do. Then say which change gives the largest improvement.

## One possible answer {walkthrough}

1. **Outdated rules.** Short passwords with forced changes produce predictable patterns. Require 12 or more characters, refuse known breached passwords, drop composition rules and forced changes, and allow pasting.
2. **User enumeration.** Use one message for both cases, and the same on registration and reset.
3. **Lockout as a weapon.** Anyone can lock any account, administrators included, with five bad guesses. Use growing delays and rate limits by address, and unlock automatically after a time.
4. **Weak and optional MFA.** Require MFA for administrators. Offer an authenticator app and passkeys, with SMS only as a fallback.
5. **A reset anyone can pass.** A pet's name is often public or guessable, and the new password appears on screen to whoever answered. Replace it with a random, short-lived, single-use link sent to the address on file. End existing sessions afterwards and notify the owner.
6. **Silent takeover.** An attacker in a session changes the email and then owns the reset channel. Require the password again, notify the old address, and confirm the new one before switching.

**The largest improvement** is requiring MFA, starting with administrators. It defeats credential stuffing and spraying, which are the most common attacks, even while the other faults are still being fixed. The reset flow comes second, since today it is a way around the password entirely.
