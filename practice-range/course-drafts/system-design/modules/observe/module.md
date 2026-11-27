---
id: course:system-design/module/observe
title: See what the system is doing
requires: []
outcomes: []
tasks: []
drills: []
---

A system you cannot see into can only be fixed by guessing. This module covers the three kinds of signal a system gives off, what to measure, and how to alert on the things that matter without waking people for the things that do not.

## Three kinds of signal

A running system should tell you what it is doing in three ways. Each answers a different question.

| Signal | What it is | Answers |
| --- | --- | --- |
| **Metrics** | Numbers measured over time | Is something wrong, and since when? |
| **Logs** | Records of single events | What exactly happened to this request? |
| **Traces** | The path of one request through every service | Where did the time go, and which service failed? |

They are used in that order. A metric shows that the error rate rose at 14:02. A trace of one failing request shows that the time was lost in the payment service. The logs of that service show the error message.

The ability to answer new questions about a system from its signals, without changing its code, is called **observability**.

## Metrics

A **metric** is a number sampled at regular intervals and stored with a timestamp: requests per second, error rate, queue length, memory in use. Metrics are cheap to keep, since they are totals and not one record per request, and they can be drawn as graphs.

For any service that answers requests, four measurements tell you most of what you need. They are often called the **four golden signals**.

- **Traffic.** How much is being asked: requests per second.
- **Errors.** The share of requests that fail.
- **Latency.** How long requests take, as percentiles.
- **Saturation.** How full the service is: processor, memory, connections, queue length.

The first three describe what users experience. The fourth warns you before they experience anything.

```text example golden readonly
   14:00   traffic  820/s    errors 0.1%    p99 240 ms    cpu 55%
   14:01   traffic  830/s    errors 0.1%    p99 250 ms    cpu 56%
   14:02   traffic  825/s    errors 4.8%    p99 2900 ms   cpu 58%
   14:03   traffic  610/s    errors 9.2%    p99 5000 ms   cpu 41%

   Traffic and cpu are normal at 14:02. Errors and latency are not.
   The fault is not load. Look at what changed at 14:02.
```

## Percentiles, not averages

Latency must be recorded as **percentiles**. The p50 is the time that half of the requests beat. The p99 is the time that 99 out of 100 beat.

An average hides the slow requests. If 99 requests take 100 ms and one takes 10 seconds, the average is 199 ms, which describes no request at all. The p99 of 10 seconds describes the one user in a hundred who had a bad time.

At scale that one percent is many people. With 1,000 requests per second, a bad p99 means 10 slow requests every second.

## Logs

A **log** line records one event: a request handled, an error, a decision the code made. Logs carry the detail that metrics leave out.

Two practices make logs useful at scale.

**Structured logs.** Write each entry as fields, usually JSON, and not as a free sentence. A field can be searched and counted. A sentence has to be picked apart by pattern.

**A request ID on every line.** Create an ID when a request enters the system, pass it to every service it touches, and include it in every log line. Then one search gathers everything that happened to that request, across all services. It is also called a correlation ID.

```json example structured readonly
{
  "time": "2025-03-04T14:02:11Z",
  "level": "error",
  "service": "orders",
  "request_id": "9f2c1a7e",
  "message": "payment call failed",
  "status": 504,
  "duration_ms": 3000
}
```

Two cautions. Logs are costly in volume, so choose levels with care and sample the routine ones. And logs must not contain secrets or personal data: no passwords, tokens, card numbers or full request bodies. That last point is general guidance, not a statement of any organization's policy.

## Traces

A **trace** follows one request through every service it passes. It is made of **spans**. A span is one piece of work, with a start time, a duration and the ID of the span that caused it.

Drawn on a time axis, a trace shows at a glance where the time went and which calls ran side by side or one after another.

```text example trace readonly
   request 9f2c1a7e                                       total 1,240 ms

   web          |==================================================|
   orders         |==============================================|
   inventory        |===|                                   40 ms
   pricing               |===|                              35 ms
   payment                    |=================================|
                                                         1,100 ms
   database                                                   |=| 20 ms

   The time is in payment. The other services are fine.
```

## What does it show {prediction}

A page is slow. Its trace shows 30 spans to the same database, each 8 ms, one after another, and nothing else of note.

:::question trace-read
What is the cause?
- [ ] The database is slow :: Each query took 8 ms, which is normal.
- [x] The page makes 30 separate queries one after another :: 30 times 8 ms is 240 ms of waiting. It is the one-query-per-item pattern. One query for all the items would take a single round trip.
- [ ] The network between the services is slow :: A slow network would stretch each span. Each one is short. There are simply too many.
:::

## Alert on what users feel

An **alert** asks a person to act. A good alert is urgent, about something real, and something that person can do something about. Most bad alerting comes from breaking one of those three.

The most useful rule is to alert on **symptoms**, not causes. A symptom is something a user experiences: errors, slowness, wrong results. A cause is something inside the system: high processor use, a restarted process, a full disk.

- Processor use at 90% may be perfectly fine if requests are fast and succeeding.
- A process that restarts and recovers by itself needs no human.
- An error rate above the SLO always matters, whatever caused it.

Alert on the symptom and use the cause metrics on a dashboard to find the reason. The exceptions are causes that will certainly become symptoms and give you time to act: a disk that will be full in four hours, a certificate that expires in two weeks.

| Alert | Good? |
| --- | --- |
| Error rate above 1% for 5 minutes | Yes. Users are affected |
| p99 latency above the SLO for 10 minutes | Yes |
| Disk will be full within 4 hours | Yes. It is certain, and there is time to act |
| Processor use above 80% | No. Not a problem by itself |
| One request failed | No. A single failure is noise |

## Alert fatigue

Every alert that turns out not to matter teaches people to ignore alerts. After enough of them, the real one is missed. This is **alert fatigue**, and it is how monitored systems still have long outages.

Treat a noisy alert as a bug. For each one that fires, ask: did someone need to act? If not, fix the alert: raise its threshold, require it to last longer, or delete it. Separate two levels clearly. A **page** wakes someone now. A **ticket** waits for working hours.

Every alert should link to a short runbook: what it means, what to check first, and how to make things better for now.

## Dashboards

A dashboard for a service should answer one question in ten seconds: is it healthy? Put the four golden signals at the top. Mark deploys and configuration changes on the time axis, since most incidents begin with a change. Put the detail below for when the top shows a problem.

A dashboard with a hundred graphs answers no question. Fewer graphs, each chosen for a reason, serve better.

## Monitor from outside too

Everything above is measured inside the system. If the load balancer is down, or DNS is wrong, no request arrives, so the inside sees no errors at all. The graphs look calm while every user is locked out.

A **synthetic check** closes that gap. A small program outside your network performs a real user action every minute, such as loading the login page, and alerts when it fails. It is the only signal that covers the whole path, including the parts you do not run.

## The quiet outage {prediction}

At 03:00 a DNS record is deleted by mistake. The site becomes unreachable. The service's dashboard shows an error rate of 0% and no latency problems.

:::question outside
Why does the dashboard look healthy, and what would have caught it?
- [ ] The dashboard is broken :: It is working. It reports what the servers see.
- [x] No requests reach the servers, so there is nothing to fail. A check from outside, or an alert on traffic dropping to zero, would have caught it :: Error rate is failures divided by requests. With no requests it stays at zero. The outage is visible only from the user's side, or as missing traffic.
- [ ] DNS failures never last long enough to matter :: A deleted record stays deleted until somebody restores it.
:::

## Exercise: instrument a service {independent}

A checkout service receives requests from a web front end, calls a payment provider and a stock service, and writes orders to a database. It currently logs free-text lines and has no metrics or traces. Last week it was slow for two hours before anyone noticed.

List the metrics you would add, what each log line must contain, what tracing needs, and the three alerts you would create. Say which single addition would have shortened last week's two hours the most.

## One possible answer {walkthrough}

**Metrics**

- Requests per second, by endpoint.
- Error rate, by endpoint and by status code.
- Latency as p50, p95 and p99, by endpoint.
- The same three for each outbound call: payment, stock and database.
- Saturation: processor, memory, the connection pool in use, and the length of any queue.

Measuring each dependency separately is what tells you whose fault a slowdown is.

**Logs.** Structured, with the time, level, service, request ID, endpoint, status and duration. No card data and no tokens.

**Tracing.** Create a request ID at the front end, pass it in a header through every call, and record one span for each outbound call.

**Alerts**

1. Page: checkout error rate above 1% for 5 minutes.
2. Page: checkout p99 latency above 2 seconds for 10 minutes.
3. Page: a synthetic check that performs a test checkout every minute fails three times in a row.

A ticket-level alert on connection pool use above 80% gives early warning without waking anyone.

**What would have helped most.** The latency alert. The slowness lasted two hours because nobody was told. The traces and per-dependency metrics would then have shortened the search for the cause. Noticing comes first, and noticing is what an alert is for.
