---
id: course:ts-foundations/module/checks
title: Writing tests
requires: ["function","import-export","array"]
outcomes: [{"id":"predict","can":"Explain which boundary test distinguishes a defect from its fix.","assessment":["predict","explain"]},{"id":"helper","can":"Read a test helper's report of expected and actual values.","assessment":["helper"]},{"id":"threshold","can":"Repair a threshold","assessment":["course:ts-foundations/task/checks-threshold"]},{"id":"choose-test","can":"Test a faulty sum","assessment":["course:ts-foundations/task/checks-choose-test"]},{"id":"test-order","can":"Catch a reversed pair","assessment":["course:ts-foundations/task/checks-test-order"]}]
tasks: [{"id":"course:ts-foundations/task/checks-threshold","path":"tasks/threshold/task.json"},{"id":"course:ts-foundations/task/checks-choose-test","path":"tasks/choose-test/task.json"},{"id":"course:ts-foundations/task/checks-test-order","path":"tasks/test-order/task.json"}]
review: {"task":"course:ts-foundations/task/checks-test-order","afterModule":"course:ts-foundations/module/async","evidence":"Use a fresh answer on a later visit. An unaided pass on the changed case adds independent evidence. Preserve hint use and solution reveals with their attempts."}
drills: ["callbacks/predicate","narrowing/guard-clause"]
drillGap: The linked drills isolate syntax. This module checks the combined behavior on varied inputs.
---

A test runs code with an input you chose and compares the result with the answer you expected. A good test fails on broken code and passes on correct code.

## Write a check that finds a defect

- A test has three parts: an input, the expected result, and the actual result from the code.
- A boundary case is an input right where a rule changes, such as exactly at a limit. Bugs often live there.
- When a test fails, start from the first failing check and trace that input.
- A regression test is a test you keep after fixing a bug, so the bug cannot come back unnoticed.

## Predict before running {prediction}

The rule is "busy at 3 or more". Read the example and predict what it prints.

```typescript example trace
function busy(n: number): boolean {
  return n > 3;
}
console.log(busy(3) === true);
console.log(busy(4) === true);

```

```output
false
true
```

:::question predict example=trace
Which check fails?
- [x] The first comparison :: `3 > 3` is false, but the rule says 3 is busy.
- [ ] The second comparison :: `4 > 3` is true, so this check passes.
:::

## Trace the example {walkthrough}

The bug only shows at the boundary.

- At 3, the expected result is `true` but the code returns `false`. This test catches the bug.
- At 4, both the buggy `n > 3` and the fixed `n >= 3` return `true`. This test cannot tell them apart.
- To check a test, run it on both the broken and the fixed version. It should fail on one and pass on the other.

Passing the function under test as a parameter lets one test check several versions.

@example trace

## Check your explanation {prediction}

Read the example again and choose the explanation that fits.

@example trace

:::question explain example=trace
Would testing only 4 detect the bug?
- [ ] Yes, 4 is above the limit. :: The bug only shows at the limit.
- [x] No, both versions return `true` for 4. :: An input that gives the same result for both versions cannot tell them apart.
:::

## A small test helper {prediction}

Test frameworks print the expected and actual values when a check fails. This helper does the same. Predict what it prints.

```typescript example helper
function check(name: string, actual: unknown, expected: unknown): void {
  const ok = actual === expected;
  console.log(ok ? `pass ${name}` : `FAIL ${name}: expected ${expected}, got ${actual}`);
}
function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}
check("two values", average([2, 4]), 3);
check("empty", average([]), 0);
check("one value", average([5]), 6);

```

```output
pass two values
pass empty
FAIL one value: expected 6, got 5
```

:::question helper example=helper
Which part is wrong when `one value` fails?
- [ ] `average` :: The average of `[5]` really is 5.
- [x] The expected value in the test :: A test can be wrong too. When a check fails, check the expected value as well as the code.
:::

## Repair a threshold {modification}

Fix the comparison so a count exactly at the limit counts as busy.

@task checks-threshold

## Test a faulty sum {independent}

Write a test that passes for a correct sum and fails for one that skips the last item.

@task checks-choose-test
