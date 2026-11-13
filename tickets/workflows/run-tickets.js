export const meta = {
  name: 'run-tickets',
  description: 'Run the open tickets on the Herdr tickets board for one repo, one agent per ticket, in order',
  whenToUse: 'A batch of tickets is planned and can run with little input. Tickets end in Review or Blocked on the board.',
  phases: [
    { title: 'Plan', detail: 'read the board and work out which tickets wait on which' },
    { title: 'Work', detail: 'one agent per ticket, as soon as the tickets it waits on are in review' },
  ],
}

// Runs the tickets of one repo. Each agent reports through ticket.mjs, so the board follows along.
//
// args (all optional):
//   folder  the repo, default: the folder the session is in
//   only    ticket numbers to run, default: every open ticket
//   model   the model for the ticket agents, default: the session's
//   cli     how to run ticket.mjs, default: the copy Herdr has installed
const opts = args ?? {}
const cli = opts.cli ?? 'node ~/.config/herdr-app/mods/tickets/ticket.mjs'
const where = opts.folder ? ` --in "${opts.folder}"` : ''
const only = Array.isArray(opts.only) ? opts.only.map(Number) : null
const place = opts.folder ? `the repo at ${opts.folder}` : 'the repo you are in'

const PLAN = {
  type: 'object',
  properties: {
    tickets: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          number: { type: 'integer' },
          title: { type: 'string' },
          needs: { type: 'array', items: { type: 'integer' }, description: 'tickets in this list that must be in review before this one starts' },
        },
        required: ['number', 'title', 'needs'],
      },
    },
    left_out: {
      type: 'array',
      items: { type: 'object', properties: { number: { type: 'integer' }, why: { type: 'string' } }, required: ['number', 'why'] },
    },
  },
  required: ['tickets', 'left_out'],
}

const RESULT = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['review', 'blocked', 'failed'] },
    summary: { type: 'string', description: 'what was done, or the question, or why it failed' },
    for_others: { type: 'string', description: 'what agents on later tickets need to know. Empty when nothing.' },
  },
  required: ['status', 'summary', 'for_others'],
}

phase('Plan')
const plan = await agent(
  `You are planning a run of tickets for ${place}. Do not change any file and do not change any ticket.

Run \`${cli} list --json${where}\` to read the tickets.
Take every ticket whose status is "todo", and every ticket whose status is "doing" with runner "workflow" (an earlier run left it, often with an answer or requested changes).${only ? ` Of those, take only these numbers: ${only.join(', ')}.` : ''}
Leave out a "doing" ticket with a terminal: an agent in Herdr has it. List each ticket you looked at and did not take in left_out, with why. Do not list done tickets.

For each ticket you take, read its description and criteria, look at the code it will touch, and fill in needs: the other taken tickets that must be finished first. Ticket B needs ticket A when B builds on what A makes, or when both will change the same files. Tickets that need nothing of each other run at the same time in one checkout, so be strict about shared files. Never list a ticket that is not in your taken list.`,
  { label: 'plan', phase: 'Plan', schema: PLAN },
)
if (!plan) return { error: 'The plan agent did not finish.' }

const byNumber = new Map(plan.tickets.map((t) => [t.number, t]))
// A need that is not part of this run cannot be waited on, so it is dropped.
for (const t of plan.tickets) t.needs = t.needs.filter((n) => n !== t.number && byNumber.has(n))
log(`${plan.tickets.length} ${plan.tickets.length === 1 ? 'ticket' : 'tickets'} to run${plan.left_out.length ? `, ${plan.left_out.length} left out` : ''}`)

const work = (t, notes) => `You are working on ticket #${t.number} ("${t.title}") in ${place}. Other agents may be working on other tickets in the same checkout right now, so change only what your ticket needs.

1. Run \`${cli} start ${t.number} --runner workflow${where}\`.
2. Run \`${cli} show ${t.number}${where}\` and read it. An "Answer" or "Changes requested" line is what a person said about earlier work on this ticket: follow it.
3. Do the work. Check each "Done when" item yourself. Do not commit or push unless the ticket says to.
4. End in exactly one of these ways:
   - Finished and checked: run \`${cli} submit ${t.number} "<what you did and how you checked it>"${where}\` and return status "review".
   - You need a decision from a person, or the ticket's scope is wrong: run \`${cli} block ${t.number} "<one clear question, with the choice you suggest>"${where}\` and return status "blocked". Nobody can answer you during this run, so stop there.
   - Something broke that you cannot fix: run \`${cli} block ${t.number} "<what broke>"${where}\` and return status "failed".

Never change another ticket. If you found something that changes what another ticket should do, say so in for_others and in your submit or block text.
${notes.length ? `\nWhat earlier tickets in this run reported:\n${notes.join('\n')}` : ''}`

phase('Work')
const results = new Map()
const notes = []
const waiting = new Set(plan.tickets.map((t) => t.number))
const skipped = []

while (waiting.size) {
  // A ticket whose need did not reach review cannot start in this run.
  for (const n of [...waiting]) {
    const bad = byNumber.get(n).needs.find((need) => results.has(need) && results.get(need).status !== 'review')
    if (bad === undefined) continue
    waiting.delete(n)
    skipped.push({ number: n, why: `it waits on #${bad}, which ended ${results.get(bad).status}` })
    results.set(n, { status: 'skipped', summary: '', for_others: '' })
    log(`#${n} not started: it waits on #${bad}`)
  }
  const ready = [...waiting].filter((n) => byNumber.get(n).needs.every((need) => results.get(need)?.status === 'review'))
  if (!ready.length) {
    // What is left waits on itself in a circle. One at a time is the safe order.
    const next = [...waiting][0]
    if (next === undefined) break
    log(`#${next} started alone: the tickets left wait on each other`)
    ready.push(next)
  }
  const sent = [...notes]
  const done = await parallel(ready.map((n) => () =>
    agent(work(byNumber.get(n), sent), { label: `#${n} ${byNumber.get(n).title}`.slice(0, 48), phase: 'Work', schema: RESULT, ...(opts.model ? { model: opts.model } : {}) })))
  ready.forEach((n, i) => {
    const r = done[i] ?? { status: 'failed', summary: 'The agent did not finish.', for_others: '' }
    waiting.delete(n)
    results.set(n, r)
    log(`#${n} ${r.status}`)
    notes.push(`#${n} ${byNumber.get(n).title} (${r.status}): ${r.summary}${r.for_others ? ` For other tickets: ${r.for_others}` : ''}`)
  })
}

const list = (status) => plan.tickets.filter((t) => results.get(t.number)?.status === status)
  .map((t) => ({ number: t.number, title: t.title, summary: results.get(t.number).summary, for_others: results.get(t.number).for_others }))
return { review: list('review'), blocked: list('blocked'), failed: list('failed'), skipped, left_out: plan.left_out }
