---
id: course:ts-foundations/module/values
title: Types and inference
requires: ["save-run","read-output"]
outcomes: [{"id":"trace","can":"Predict the order and values printed after a numeric update.","assessment":["predict-count","course:ts-foundations/task/arrival-log"]},{"id":"infer","can":"Declare a numeric variable with an inferred type and calculate the number remaining.","assessment":["course:ts-foundations/task/remaining"]},{"id":"label","can":"Use a fixed text binding and combine supplied text in order.","assessment":["course:ts-foundations/task/shelf-label"]},{"id":"repair","can":"Identify a number assigned to a text variable and repair the numeric count.","assessment":["predict-error","course:ts-foundations/task/repair-count"]},{"id":"transfer","can":"Preserve a starting value when calculating a changed value in another setting.","assessment":["course:ts-foundations/task/seat-snapshot"]}]
tasks: [{"id":"course:ts-foundations/task/arrival-log","path":"tasks/arrival-log/task.json"},{"id":"course:ts-foundations/task/remaining","path":"tasks/remaining/task.json"},{"id":"course:ts-foundations/task/shelf-label","path":"tasks/shelf-label/task.json"},{"id":"course:ts-foundations/task/repair-count","path":"tasks/repair-count/task.json"},{"id":"course:ts-foundations/task/seat-snapshot","path":"tasks/seat-snapshot/task.json"}]
review: {"task":"course:ts-foundations/task/seat-snapshot","afterModule":"course:ts-foundations/module/functions","evidence":"Open a fresh starter after Functions, with the prior answer closed. A first unaided pass on both counts is later evidence of tracing and arithmetic. A hinted pass remains assisted."}
drills: ["variables/const-number","variables/let-reassign","variables/infer-let"]
drillGap: These drills isolate declaration forms. They do not check a snapshot against changing supplied input pairs.
---

A thermometer starts the day at one temperature. When it warms up, the reading changes. How can a program keep the original reading and show the new one?

## Give a value a name

A value is a piece of data. 4 is a number. "Desk" is text (a string). true and false are the two boolean values. A variable is a name for a value. const opening = 4 gives a fixed name its first value. let open = opening gives a second name the same number and allows us to assign it a new value later. Read = as “gets.” A semicolon ends a statement. The program runs these statements from top to bottom.

## Trace the count {prediction}

Read the example before running it. console.log(value) prints the current value on its own line. The + between two numbers adds them. On a line such as open = open + 1, calculate the right side first.

```typescript example board
const opening = 4;
let open = opening;
console.log(open);
open = open + 1;
console.log(open);

```

```output
4
5
```

:::question predict-count example=board
What are the two output lines, in order?
- [x] 4 then 5 :: The first print runs before the assignment, the second after it.
- [ ] 5 then 5 :: The later assignment cannot change a line that has already printed.
- [ ] 4 then 4 :: open is a separate variable and receives the new number.
:::

## Run it {walkthrough}

Run the example and compare each printed line with your prediction. The first line of output shows the opening count. The next print sees the updated open count. Assigning open a new value leaves opening at 4. For numbers, subtraction uses -. For text, + joins the pieces in order. In the second example the spaces inside the quotes become part of the label.

@example board

```typescript example label
const area = "Desk";
const label = area + " shelf";
console.log(label);

```

```output
Desk shelf
```

## Predict a type error {prediction}

TypeScript uses the initial value to work out a type (inference). In let count = 4, count can hold another number. Writing : number after the name would state the type explicitly (an annotation). Quoted digits are text. Look at the marked error example before you check it.

```typescript example bad-count diagnostics=[{"code":2322,"line":2}]
let count = 4;
count = "5";

```

:::question predict-error example=bad-count
What happens when the Practice Range checker checks this file?
- [ ] It prints 5. :: The checker checks types before running the file, and there is no print call.
- [ ] It converts the text to a number. :: Assignment does not parse text.
- [x] It reports an error on the assignment. :: count was inferred as number. The quotes make the new value a string.
:::

## Read the diagnostic {walkthrough}

Check the marked file. TS2322 is the compiler’s way of saying the value on the right has a type the name on the left cannot hold. The checker stops before running this answer. At runtime JavaScript uses the values themselves. In the label example it joins strings. A type annotation would not convert quoted digits into a number.

@example bad-count

## Update a delivery {modification}

Read the supplied opening and change values above the editor. Each check can supply different values. An input declaration such as const opening: number = 6 supplies a number you can read. Edit the starter, save, and compare both prints.

@task arrival-log

## Write two small answers {independent}

Work from the prompt, then save each answer. One computes a changing number. The other constructs a fixed text label.

@tasks remaining shelf-label

## Repair a broken count {debugging}

Read the compiler message before editing. Trace the value in the starter back to the line that gave it its type.

@task repair-count
