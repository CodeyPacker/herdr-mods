---
id: course:cs-foundations/module/methods
title: Methods
requires: ["variable","number-types","text","interpolation","branch","comparison"]
outcomes: [{"id":"trace","can":"Trace separate calls and say which names are local to a method.","assessment":["outputs","scope","course:cs-foundations/task/methods-after-arrivals"]},{"id":"branching","can":"Write a method that returns different results on different paths.","assessment":["course:cs-foundations/task/methods-extra-hours"]},{"id":"compose","can":"Return a value and use one method from another.","assessment":["course:cs-foundations/task/methods-summary"]},{"id":"transfer","can":"Write a method from a description and keep the sign of its result.","assessment":["course:cs-foundations/task/methods-movement"]}]
tasks: [{"id":"course:cs-foundations/task/methods-after-arrivals","path":"tasks/after-arrivals/task.json"},{"id":"course:cs-foundations/task/methods-extra-hours","path":"tasks/extra-hours/task.json"},{"id":"course:cs-foundations/task/methods-summary","path":"tasks/summary/task.json"},{"id":"course:cs-foundations/task/methods-movement","path":"tasks/movement/task.json"}]
review: {"task":"course:cs-foundations/task/methods-movement","afterModule":"course:cs-foundations/module/classes","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted."}
drills: ["methods/return","methods/parameter","methods/two-parameters","methods/void","methods/expression"]
drillGap: These drills practise one method form each. They do not check several calls with different inputs.
---

A **method** packages steps under a name so they can be used again with different values. This module covers parameters, return values and **scope**: which names exist where.

## Parts of a method

```csharp
int AddHours(int hours, int extra)
{
    int total = hours + extra;
    return total;
}
```

- `int` before the name is the **return type**: the kind of value the method gives back.
- `hours` and `extra` are **parameters**: names for the values a caller passes in.
- `return` sends a value back to the caller and ends the call.
- A method that gives nothing back has the return type `void`.
- A conditional expression chooses one of two values: `condition ? whenTrue : whenFalse`. For example, `hours > included ? hours - included : 0` can be returned directly.
- When the body is a single expression you can write it with `=>`: `int Twice(int n) => n * 2;`
- A name declared inside a method's braces, such as `total`, exists only there. That region is the name's **scope**. Each call gets its own fresh parameters and local variables.

In exercises your methods go inside a class the checker supplies, so each one starts with `public static`. `public` lets other code call it. `static` means it is called by name, without an object. The Classes module explains both.


## Predict two calls {prediction}

Read the method and both calls before running.

```csharp example calls
int AddHours(int hours, int extra)
{
    int total = hours + extra;
    return total;
}

Console.WriteLine(AddHours(2, 3));
Console.WriteLine(AddHours(1, 0));
```

```output
5
1
```

:::question outputs example=calls
Which two values print?
- [x] 5 then 1 :: The first call gets `hours` 2 and `extra` 3, so `total` is 5. The second call starts fresh with 1 and 0. The method returns its result without printing it: the caller decides what to do with it, and here it prints.
- [ ] 5 then 6 :: `total` is local to one call. It does not carry over to the next.
- [ ] 2 then 1 :: The method returns the sum of both parameters, not the first one.
:::

## Find the error {prediction}

This example does not compile. Find the line the compiler stops at, and why.

```csharp example bad-scope diagnostics=[{"code":103,"line":8}]
int AddHours(int hours, int extra)
{
    int total = hours + extra;
    return total;
}

Console.WriteLine(AddHours(2, 3));
Console.WriteLine(total);
```

:::question scope example=bad-scope
Which error does the compiler report?
- [ ] Line 3: `total` is used before it has a value. :: Line 3 declares `total` and gives it `hours + extra` in one statement. That is fine.
- [ ] Line 7: a method's result must be stored before it is printed. :: A call can go straight into `Console.WriteLine`. Line 7 compiles.
- [x] Line 8, CS0103: the name `total` does not exist there. :: `total` is declared inside `AddHours`, so its scope ends at the method's closing brace, even after a call. Use the value the method returns instead: `int sum = AddHours(2, 3);`
:::

## Return the right total {modification}

The starter compiles but returns the wrong name. Change it so the checks pass.

@task methods-after-arrivals

## Write two methods from their contracts {independent}

Work from each prompt. The first needs two paths. The second asks for two methods, where one uses the other.

@tasks methods-extra-hours methods-summary
