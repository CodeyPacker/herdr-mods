export const meta = {
  name: 'plan-tickets',
  description: 'Turn a goal into tickets on the Herdr tickets board, then let Herdr start an agent on each as it becomes ready',
  whenToUse: 'A feature or change is big enough to split up. This only writes the tickets. Herdr runs them in its own tabs.',
  phases: [
    { title: 'Plan', detail: 'read the code and write the tickets' },
    { title: 'Check', detail: 'read each ticket cold, fix what is missing, then release them to Herdr' },
  ],
}

// Writes the tickets for one goal. The tickets mod's slot starts the agents afterwards: a ticket
// starts once every ticket it waits on is approved.
//
// args:
//   goal    what to build (required). A string, or pass the whole args as a string.
//   folder  the repo, default: the folder the session is in
//   hold    true: write the tickets but do not release them. Release later with `ticket.mjs auto <numbers>`.
//   cli     how to run ticket.mjs, default: the copy Herdr has installed
const opts = typeof args === 'string' ? { goal: args } : args ?? {}
if (!opts.goal) return { error: 'plan-tickets needs a goal: what should be built?' }
const cli = opts.cli ?? 'node ~/.config/herdr-app/mods/tickets/ticket.mjs'
const where = opts.folder ? ` --in "${opts.folder}"` : ''
const place = opts.folder ? `the repo at ${opts.folder}` : 'the repo you are in'

const TICKETS = {
  type: 'object',
  properties: {
    tickets: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          number: { type: 'integer' },
          title: { type: 'string' },
          waits_on: { type: 'array', items: { type: 'integer' } },
        },
        required: ['number', 'title', 'waits_on'],
      },
    },
    notes: { type: 'string', description: 'anything the person should know: open questions, what was left out, what was changed' },
  },
  required: ['tickets', 'notes'],
}

phase('Plan')
const plan = await agent(
  `Split this goal into tickets for ${place}. Do not change any code.

The goal:
${opts.goal}

Read the code the goal touches first. Then create the tickets with:
  ${cli} create "<title>" --desc "<description>" --criteria "<done when>" [--criteria "..."] [--after <number>] --json${where}
Create them in the order they should be done, so a ticket can name earlier ones with --after.

Each ticket is done by a separate agent that starts with no memory of this plan and sees only its own ticket, plus the summaries of the tickets it waits on. So write every ticket to stand alone:
- The description says what to build, in which files or folders, and why. Name real files, functions and patterns you found. Include the decisions you made that the agent must not remake differently (names, formats, where things live).
- Every ticket has at least one --criteria the agent can check itself, such as a command that passes or a behavior it can see.
- A ticket is one piece of work that can be reviewed alone. Do not make a ticket for planning, or one that only says "test everything".

Use --after for every ticket that must be finished first: when this ticket builds on what that one makes, or when both change the same files (agents share one checkout, so two tickets on the same files must not run together). A ticket starts only after a person approves the tickets it waits on, so do not add --after where it is not needed.

If the goal needs a decision only the person can make, do not guess silently: make your best choice, say so in the ticket, and list it in notes.

Return every ticket you created with the number the command printed.`,
  { label: 'plan', phase: 'Plan', schema: TICKETS },
)
if (!plan) return { error: 'The plan agent did not finish.' }
if (!plan.tickets.length) return { tickets: [], released: false, notes: plan.notes }
const numbers = plan.tickets.map((t) => t.number)

phase('Check')
const check = await agent(
  `Tickets ${numbers.map((n) => `#${n}`).join(', ')} were just written for ${place}, for this goal:
${opts.goal}

Read each with \`${cli} show <number>${where}\`. Read it as the agent who will do it: someone who knows nothing but that one ticket and the repo. Check against the code that:
- it names the right files and says clearly what to build,
- it has "Done when" items the agent can check itself,
- it waits on every ticket it builds on, and on any other ticket that changes the same files,
- no two tickets do the same work, and nothing in the goal is left out.

Fix what is wrong with:
  ${cli} edit <number> [--title "..."] [--desc "..."] [--criteria "..."]... [--after <number>]...${where}
--criteria and --after replace the whole list, so give every item again. If part of the goal is missing, add a ticket with \`${cli} create\` as the plan did. Do not change any code.
${opts.hold ? '\nDo not release the tickets.' : `
When every ticket is right, release them all with one command, so Herdr starts their agents:
  ${cli} auto <every ticket number, yours included>${where}`}

Return the final list of tickets and, in notes, what you changed and anything the person should decide.`,
  { label: 'check', phase: 'Check', schema: TICKETS },
)

const final = check ?? plan
return {
  tickets: final.tickets,
  released: Boolean(check) && !opts.hold,
  notes: [plan.notes, check?.notes].filter(Boolean).join('\n'),
  ...(check ? {} : { warning: `The check agent did not finish, so nothing was released. Release with: ${cli} auto ${numbers.join(' ')}${where}` }),
}
