---
id: course:cs-foundations/module/transfer
title: Build and test an import report
requires: ["text-processing","string-comparison","record","dictionary","throw-catch","tests","list","loop","delegate"]
outcomes: [{"id":"import","can":"Parse input rows, reject invalid rows and aggregate valid counts by identifier.","assessment":["predict-parse","course:cs-foundations/task/transfer-import"]},{"id":"check","can":"Write a check that accepts correct import functions and rejects named faulty behaviors.","assessment":["course:cs-foundations/task/transfer-import-check"]}]
tasks: [{"id":"course:cs-foundations/task/transfer-import","path":"tasks/import/task.json"},{"id":"course:cs-foundations/task/transfer-import-check","path":"tasks/import-check/task.json"}]
review: {"task":"course:cs-foundations/task/transfer-import-check","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted.","afterCompletion":true}
drills: ["conversions/try-parse","delegates/func","collections/add","loops/foreach"]
drillGap: These drills practise individual operations. They do not check a complete import and a regression check against several known faulty implementations.
---

This final task combines text parsing, records, dictionaries, loops and tests. The first task builds an import function. The second writes a check that can distinguish the correct behavior from three named mistakes.

## Parse, validate, aggregate

Each input row must contain exactly one comma, with a name before it and a count after it. Trim both fields. A valid name is nonempty. Parse counts with `int.TryParse`, `NumberStyles.Integer` and `CultureInfo.InvariantCulture`; this accepts surrounding whitespace and a leading plus sign, but not a negative value under this contract. Reject overflow and malformed rows instead of throwing. A valid zero count still creates a key.

Aggregate names using `StringComparer.OrdinalIgnoreCase`, so different letter case refers to the same key. Return a report with totals and the number of rejected rows. An empty list gives an empty dictionary and zero rejections. Do not change the input list. Assume the list and its strings are nonnull, and that aggregate sums fit in `int`.

`TryParse` reports failure as `false` instead of throwing. Parse first, then validate the name and nonnegative count, then add the accepted count. Keep those decisions separate so every invalid row increments the rejected count once.

```csharp example parse
string raw = " Cedar , +2 ";
string[] parts = raw.Split(',');
bool parsed = int.TryParse(parts[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out int count);
Console.WriteLine(parts.Length);
Console.WriteLine(parts[0].Trim());
Console.WriteLine(parsed);
Console.WriteLine(count);
```

```output
2
Cedar
True
2
```

:::question predict-parse example=parse
Does this row have two fields, and does its count parse as 2?
- [ ] No, because of the spaces and plus sign :: NumberStyles.Integer accepts whitespace and a leading sign, and the name field is trimmed separately.
- [x] Yes :: There is one comma, so Split returns two fields. The count uses Integer style and invariant culture, which accepts surrounding whitespace and `+2`.
- [ ] Yes, but the count is 0 :: `TryParse` writes the parsed integer into `count` on success.
:::

## Import the report {independent}

Implement `Import`. Use the supplied `ImportReport` record. Follow the row rules above and keep the input unchanged.

@task transfer-import

## Test an import function {independent}

Implement `CheckImport`. It receives a candidate function and must return true for both correct candidates and false for each supplied mutant. The mutants group names case-sensitively, ignore rejected-row counts, or drop valid zero-count keys. Use test inputs that expose all three behaviors. The fixture provides the candidates, so your check is independent of the previous task. Do not inspect source text or use reflection.

@task transfer-import-check
