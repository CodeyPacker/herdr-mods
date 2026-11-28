---
id: course:cs-foundations/module/strings
title: Working with text
requires: ["method","parameter-return","text","array","list","loop","branch"]
outcomes: [{"id":"clean","can":"Clean a comma-separated tag list without changing tag order.","assessment":["predict-trim","course:cs-foundations/task/strings-clean-tags"]},{"id":"match","can":"Match exact identifiers without depending on letter case.","assessment":["predict-split","course:cs-foundations/task/strings-has-code"]},{"id":"join","can":"Build a clean display string without changing the input list.","assessment":["course:cs-foundations/task/strings-join-names"]}]
tasks: [{"id":"course:cs-foundations/task/strings-clean-tags","path":"tasks/clean-tags/task.json"},{"id":"course:cs-foundations/task/strings-has-code","path":"tasks/has-code/task.json"},{"id":"course:cs-foundations/task/strings-join-names","path":"tasks/join-names/task.json"}]
review: {"task":"course:cs-foundations/task/strings-join-names","afterModule":"course:cs-foundations/module/nulls","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted."}
drills: ["strings/interpolate"]
drillGap: This drill practises interpolation. It does not check trimming, splitting or exact text comparison.
---

Text processing often means making a new string or list from existing text. A `string` is immutable: a method such as `Trim()` returns a cleaned string and leaves the original alone. If you ignore its return value, nothing changes.

## Trim returns a string

`Trim()` removes whitespace at the beginning and end. It does not change the string it was called on. A `char` uses single quotes, as in `char separator = ','`; a `string` uses double quotes, as in `string label = "x"`. A `char` is one UTF-16 code unit, while `string.Length` counts UTF-16 code units, not user-perceived characters. Some visible symbols use more than one code unit.

```csharp example trim
string raw = "  red ";
raw.Trim();
Console.WriteLine($"[{raw}]");
Console.WriteLine(raw.Trim());
Console.WriteLine("A,B".Length);
```

```output
[  red ]
red
3
```

:::question predict-trim example=trim
What are the first two output lines?
- [x] `[  red ]`, then `red` :: `Trim()` returns a new string. The first call's result is ignored, so `raw` still has spaces. The second call is printed directly.
- [ ] `red`, then `red` :: Calling `Trim()` does not update `raw`.
- [ ] The first line is blank :: The original string still contains its spaces.
:::

## Split keeps empty fields

`Split(',')` separates at each comma and keeps empty fields by default. In `"a,,b,".Split(',')`, the fields are `"a"`, `""`, `"b"` and `""`. `string.Join(", ", fields)` places the separator between items. It does not trim items or remove empty ones for you.

An exact identifier match should use a clear comparison rule. `StringComparison.Ordinal` compares code units. `OrdinalIgnoreCase` compares identifiers without case differences. Linguistic comparisons are for language-aware text sorting and searching, not machine identifiers. Do not use substring matching when the whole identifier must match.

```csharp example split
string[] fields = "A,,b,".Split(',');
Console.WriteLine(fields.Length);
Console.WriteLine(string.Join("|", fields));
Console.WriteLine("Ab".Equals("aB", StringComparison.OrdinalIgnoreCase));
Console.WriteLine("Ab".Contains("b", StringComparison.OrdinalIgnoreCase));
```

```output
4
A||b|
True
True
```

:::question predict-split example=split
How many fields does `Split` return, and does the case-insensitive exact comparison succeed?
- [ ] Three, True :: Empty fields before, between or after separators are kept.
- [x] Four, True :: There are four fields, including the empty one between the two commas and the empty one after the final comma. OrdinalIgnoreCase allows the case difference while still comparing the whole two-character string.
- [ ] Four, False :: OrdinalIgnoreCase ignores letter case, so `Ab` equals `aB`.
:::

## Clean a tag list {modification}

Split a comma-separated string, trim each field, discard empty fields and keep the order and duplicates.

@task strings-clean-tags

## Match an identifier {independent}

Return true only when one complete array item matches the wanted code, ignoring case. Do not trim or match only part of an item.

@task strings-has-code

## Join names for display {independent}

Trim names, omit names that contain only whitespace, and join the rest with comma and space. Preserve order and duplicates. Do not change the input list.

@task strings-join-names
