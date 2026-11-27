---
id: course:cs-foundations/module/methods
title: Give a calculation a name
requires: ["variable","number-types","text","interpolation","branch","comparison"]
outcomes: [{"id":"trace","can":"Trace separate calls and say which names are local to a method.","assessment":["outputs","scope","course:cs-foundations/task/methods-after-arrivals"]},{"id":"branching","can":"Write a method that returns different results on different paths.","assessment":["course:cs-foundations/task/methods-extra-hours"]},{"id":"compose","can":"Return a value and use one method from another.","assessment":["course:cs-foundations/task/methods-summary"]},{"id":"transfer","can":"Write a method from a description and keep the sign of its result.","assessment":["course:cs-foundations/task/methods-movement"]}]
tasks: [{"id":"course:cs-foundations/task/methods-after-arrivals","path":"tasks/after-arrivals/task.json"},{"id":"course:cs-foundations/task/methods-extra-hours","path":"tasks/extra-hours/task.json"},{"id":"course:cs-foundations/task/methods-summary","path":"tasks/summary/task.json"},{"id":"course:cs-foundations/task/methods-movement","path":"tasks/movement/task.json"}]
review: {"task":"course:cs-foundations/task/methods-movement","afterModule":"course:cs-foundations/module/classes","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted."}
drills: ["methods/return","methods/parameter","methods/two-parameters","methods/void","methods/expression"]
drillGap: These drills practise one method form each. They do not check several calls with different inputs.
---

A method packages steps under a name so they can be used again with different values. This module covers parameters, return values and scope: which names exist where.

## Parts of a method

A method has a return type, a name, parameters in brackets and a body in braces. In int AddHours(int hours, int extra), the method takes two ints and gives back an int. Parameters are names for the values a caller passes in. return sends a value back to the caller and ends the call. A method that gives nothing back has the return type void. When the body is a single expression you can write it with =>, as in int Twice(int n) => n * 2;. In exercises your methods go inside a class the checker supplies, so each one starts with public static. public lets other code call it. static means it is called by name, without an object. The Classes module explains both.

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

## Predict two calls {prediction}

Read the method and both calls before running.

@example calls

:::question outputs example=calls
Which two values print?
- [x] 5 then 1 :: Each call works out its own total from its own inputs.
- [ ] 5 then 6 :: total is local to one call. It does not carry over to the next.
- [ ] 2 then 1 :: The method returns the sum of both parameters, not the first one.
:::

## Trace the calls {walkthrough}

The first call passes 2 and 3, so hours is 2, extra is 3 and total is 5. The second call starts fresh with 1 and 0. total does not carry over: each call gets its own parameters and its own local variables. The method returns a value without printing it. The caller decides what to do with the result.

@example calls

## Use a name outside its method {prediction}

The last line reads a name that was declared inside the method. Read the example before checking.

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
What happens when you check this example?
- [ ] It prints 5 twice. :: total exists only inside AddHours. The last line cannot read it.
- [x] The compiler reports an error on line 8. :: total is local to the method body, so line 8 uses a name that does not exist there (CS0103).
- [ ] It prints 5, then 0. :: A missing name is a compile error, not a default value. Nothing runs.
:::

## Read the compiler error {walkthrough}

Check the example. CS0103 says the name total does not exist in the current context. total belongs to the body of AddHours (its scope). Code outside those braces cannot see it, even after a call. Use the value the method returns.

@example bad-scope

## Return the right count {modification}

The starter compiles but returns the wrong name. Change it so the checks pass.

@task methods-after-arrivals

## Write two methods from their contracts {independent}

Work from each prompt. The first needs two paths. The second asks for two methods, where one uses the other.

@tasks methods-extra-hours methods-summary
