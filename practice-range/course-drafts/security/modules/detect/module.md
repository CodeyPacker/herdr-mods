---
id: course:security/module/detect
title: Detect and respond
requires: []
outcomes: []
tasks: []
drills: []
---

Prevention fails sometimes. What happens next depends on whether anyone notices and whether they know what to do. This module covers what to record, what to alert on, and the steps of handling an incident.

The advice here is general guidance, not any organization's policy. If you suspect a real incident at work, follow your organization's process and tell the security team. Do not investigate alone.

## Assume a breach will happen

Every defence in this course lowers the chance of a breach. None brings it to zero. A design that assumes prevention always works has no plan for the day it does not.

Two measures describe how well an organization copes.

- **Time to detect:** how long an attacker is inside before anyone knows. Industry reports regularly put this at weeks or months.
- **Time to respond:** how long it takes to stop them once known.

Both are decided before the incident, by what was logged, what raises an alert, and whether a plan exists. An attacker who is detected in an hour has done a fraction of the damage of one who stays for three months.

## Security logging

Operational logs answer "why is it slow". **Security logs** answer different questions: who did what, when, from where, and was it allowed?

Record these events.

- **Authentication:** logins, failed logins, logouts, password changes and resets, MFA changes.
- **Authorization failures:** every refused access. Honest users rarely trigger these, so they are a strong signal.
- **Privilege changes:** a role granted, a user made administrator, a permission or policy changed.
- **Sensitive actions:** exports, bulk reads, deletions, changes to payment details, changes to security settings.
- **Administrative actions:** anything done through an admin tool or with elevated access.
- **Input validation failures** that look like attacks, such as injection patterns.

For each event, record who (user ID), what (the action and the object), when (a timestamp in UTC), where from (source address, session), and the outcome. Do not record the sensitive data itself.

```json example audit-event readonly
{
  "time": "2025-03-04T14:02:11Z",
  "event": "role_granted",
  "actor_id": 204,
  "target_user_id": 5521,
  "role": "admin",
  "source_ip": "203.0.113.24",
  "session_id_hash": "9f2c1a7e",
  "outcome": "success"
}
```

## Logs an attacker cannot erase

An attacker who gains control of a server will try to remove the traces. Logs kept only on that server can be edited or deleted.

- **Ship logs off the machine** as they are written, to a central store.
- **Make that store append-only** for the systems that write to it. They can add entries and cannot change or delete them.
- **Restrict who can read and administer it,** and log that access too.
- **Keep them long enough.** If breaches are often found months later, 14 days of logs will not show how one began.
- **Synchronise clocks** across systems, so that events from different sources can be put in order.

## Alerts worth acting on

Logs that nobody looks at detect nothing. An **alert** turns a pattern in the logs into a notice to a person.

Useful security alerts include:

- Many failed logins for one account, or a few failures each across many accounts.
- A successful login right after a burst of failures.
- A login from a new country, or two logins too far apart to be the same person.
- A new administrator, or a change to access policies, outside a known change.
- A spike in authorization failures from one user.
- An unusually large export or download.
- A credential used from an unexpected place, such as a server's key used from an unknown address.
- Security logging being switched off.

The last one matters. Turning off logging is among the first things an attacker does, so it should be among the loudest alerts.

Alerts that fire constantly and mean nothing teach people to ignore all of them. Each alert should be rare, should say what it means, and should link to what to do.

## Which signal {prediction}

A login log shows 4,000 failed logins in ten minutes. They are spread over 3,900 different accounts, each with one or two attempts, all from a small set of addresses. Per-account lockout triggers at five failures.

:::question spraying
What is happening, and does the lockout help?
- [ ] Ordinary users mistyping passwords :: Nearly four thousand different accounts failing within ten minutes from a few addresses is not ordinary.
- [x] Password spraying or credential stuffing, and the per-account lockout never triggers :: Each account sees only one or two attempts, which is under the limit. The pattern is visible only across accounts. It needs an alert and a rate limit by source.
- [ ] A brute-force attack on one account :: That would be many attempts against a single account.
:::

## What an incident is

A **security incident** is an event that has harmed, or may have harmed, the confidentiality, integrity or availability of a system or its data. Examples: a credential found in a public place, an account acting strangely, data sent somewhere it should not go, malware on a machine.

Most reports turn out to be nothing. That is fine. The costly failure is the opposite one: a real incident that someone noticed and did not report, because they were unsure or did not want to cause a fuss.

So the rule for an individual is simple. If something looks wrong, report it at once through the agreed channel. Deciding whether it is real is the responders' job.

## The stages of response

Incident response follows a sequence. Standard descriptions, such as NIST's, differ in wording and agree on the shape.

1. **Prepare.** Before anything happens: a plan, contact lists, access, logs, practice.
2. **Detect and analyse.** Is this real? What is affected? How bad is it?
3. **Contain.** Stop it from spreading or continuing.
4. **Eradicate.** Remove the attacker's access and the flaw that let them in.
5. **Recover.** Restore systems to normal, and watch closely.
6. **Learn.** Review what happened and improve.

```text example stages readonly
   prepare --> detect --> contain --> eradicate --> recover --> learn
      ^                                                          |
      +----------------------------------------------------------+
                     what was learned improves preparation
```

## Contain first, and keep the evidence

When an incident is confirmed, the first aim is **containment**: limiting the damage. Typical actions are revoking a leaked credential, disabling a compromised account, cutting a system off from the network, blocking an address.

Two instincts are natural and often wrong.

- **Wiping the machine at once.** Rebuilding destroys the evidence of what the attacker did and how they entered. Without that, you cannot tell what was taken or whether the way in is still open. Isolate the system and take a copy of its disk and memory before changing it.
- **Fixing quietly.** Changing things without recording them, or without telling the people coordinating, leaves nobody with the full picture.

Keep a timeline as you go: what was seen, what was done, when and by whom. It is needed for the analysis and often for legal reasons.

Containment also has to be complete. An attacker who was inside for weeks may hold several credentials and several ways back. Removing one and declaring victory is a common mistake.

## Communicate

An incident involves more people than the engineers fixing it.

- **One person coordinates.** They direct the work and are not also doing the technical work.
- **One channel** carries the incident's communication.
- **Tell the right people early:** the security team, management, and legal and privacy contacts. Many laws require that regulators and affected people are told within a short, fixed time after a breach of personal data is discovered. Whether and when to notify is a decision for those roles, not for an engineer.
- **Be factual.** Say what is known, what is not known yet and when the next update will come.

## Learn without blame

After recovery, hold a review. Its purpose is to improve the system, not to find someone to blame.

A **blameless review** starts from the view that people acted reasonably given what they knew, and asks why the system made the mistake easy and the detection slow. If the answer is "an engineer pasted a key into a file", the useful questions are why nothing scanned for it, why the key had such wide access, and why it took six weeks to notice.

When people fear punishment, they stop reporting. Then problems are found later, which is the worst outcome of all.

End with a short list of concrete actions, each with an owner and a date.

## Practise before it is real

A plan that has never been used will fail on its first use. Phone numbers are out of date, the access that responders need does not exist, the backup does not restore.

Run **tabletop exercises**: gather the people who would respond and talk through a scenario step by step. "A customer reports seeing another customer's invoices. What do we do first? Who do we call? Where are the logs?" An hour of this finds the gaps cheaply.

## The first move {prediction}

An engineer notices that a production server is making connections to an unknown address and running a process nobody recognises. They have administrator access to it.

:::question first-move
What should they do first?
- [ ] Delete the unknown process and reboot the server :: That destroys the evidence of what it was doing and how it got there, and the attacker's way in remains.
- [ ] Investigate on their own until they are sure, then report :: Time is lost, the attacker may notice, and one person rarely sees the whole picture.
- [x] Report it through the incident process at once, and isolate the server without wiping it :: Reporting starts the response. Isolating stops further damage and keeps the evidence that shows what was taken and how.
:::

## Exercise: handle the incident {independent}

On a Friday afternoon, a developer finds that a cloud access key for the production storage account was committed to a public repository 19 days ago. The key can read and write every storage bucket, including one that holds customer documents. Security logging for the storage account was enabled only for writes, not for reads.

Write the steps you would take, in order, using the stages from this module. Say what cannot be determined, and why. End with three improvements for the review.

## One possible answer {walkthrough}

**Detect and analyse.** Report it through the incident process immediately. The facts so far: a key with full access to customer documents has been public for 19 days. Treat it as a confirmed incident. Public repositories are scanned within minutes.

**Contain.** Revoke the key now, before anything else, even though something may break. Issue a new one for the services that need it, through the secrets manager.

**Analyse further.**

- Review the write logs for the 19 days: files added, changed or deleted, from which addresses.
- Look for anything the key could have been used to create that grants lasting access, such as new keys, new access policies or public links to buckets.
- Check billing and usage data for unusual transfer volume, which can stand in partly for missing read logs.

**What cannot be determined.** Whether customer documents were read or downloaded. Reads were not logged. The honest position is that the documents were accessible to anyone for 19 days and there is no evidence either way. That uncertainty has to be reported as it is, since it bears on any duty to notify.

**Eradicate.** Remove anything the key created. Rotate other credentials that were stored alongside it or that it could reach. Removing the key from the repository's history is tidying. It does not come first, and it does not make the old key safe.

**Communicate.** Bring in the security team, management and the privacy and legal contacts at once. Whether customers and regulators must be notified, and by when, is their decision, and the clock for it may have started at discovery.

**Recover.** Confirm that services work with the new credentials. Watch the storage account closely for some weeks.

**Three improvements**

1. Secret scanning as a pre-commit hook and in the pipeline, so that a key cannot reach a repository.
2. No long-lived, all-powerful keys. Use platform identities with access to single buckets.
3. Log reads on stores that hold customer data, so that the next incident can be measured and not guessed at.

This is a learning exercise and general guidance. In a real case, the organization's own incident process and the security team's direction apply.
