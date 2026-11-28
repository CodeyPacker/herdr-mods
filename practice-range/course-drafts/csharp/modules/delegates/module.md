---
id: course:cs-foundations/module/delegates
title: Delegates and callbacks
requires: ["method","parameter-return","list","loop","comparison","variable"]
outcomes: [{"id":"transform","can":"Apply a supplied function once per list item in order.","assessment":["predict-method-group","course:cs-foundations/task/delegates-transform"]},{"id":"visit","can":"Call a supplied action for each item in order.","assessment":["predict-capture","course:cs-foundations/task/delegates-visit"]},{"id":"capture","can":"Return independent counters that keep their own state.","assessment":["course:cs-foundations/task/delegates-counter"]}]
tasks: [{"id":"course:cs-foundations/task/delegates-transform","path":"tasks/transform/task.json"},{"id":"course:cs-foundations/task/delegates-visit","path":"tasks/visit/task.json"},{"id":"course:cs-foundations/task/delegates-counter","path":"tasks/counter/task.json"}]
review: {"task":"course:cs-foundations/task/delegates-counter","afterModule":"course:cs-foundations/module/generics","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted."}
drills: ["delegates/func","delegates/two-inputs","delegates/predicate"]
drillGap: These drills practise delegate declarations. They do not check invoking a callback once per item or keeping independent captured state.
---

A **delegate** is a value that can refer to a method. `Func<TInput, TResult>` describes a function with inputs and a result. `Action<TInput>` describes an action with an input and no result. The final type in `Func` is always the return type.

## Method group or method call

When a method fits the delegate type, its name by itself is a **method group** and can be assigned as a callback. Adding parentheses calls it now. A lambda such as `value => value * 2` is another way to describe a callback in place.

```csharp example method-group
int Double(int value) => value * 2;
Func<int, int> convert = Double;
int alreadyCalled = Double(3);
Console.WriteLine(convert(4));
Console.WriteLine(alreadyCalled);
```

```output
8
6
```

:::question predict-method-group example=method-group
What does `convert(4)` return, and what is stored in `alreadyCalled`?
- [x] 8 and 6 :: `Double` without parentheses is passed as a method. `Double(3)` is called immediately and its result, 6, is stored as an int. The later call to `convert` passes 4 and returns 8.
- [ ] 6 and a method :: `Double(3)` runs immediately, so it stores the result 6.
- [ ] 8 and 8 :: The already called method used the argument 3 and stored that result.
:::

## A lambda can capture a variable

A **lambda** is an unnamed function expression. It can be a short expression such as `value => value * 2`, or a block such as `value => { int doubled = value * 2; return doubled; }`. It can read variables from the surrounding scope. A captured variable is shared with the lambda, so later changes are visible when the lambda runs. The callback runs when the caller invokes it. These examples are synchronous; a callback contract must say if it stores or invokes callbacks later. A returned lambda can keep a local variable alive after the method that created it has returned.

```csharp example capture
int count = 2;
Func<int> read = () => count;
count = 5;
Console.WriteLine(read());
```

```output
5
```

:::question predict-capture example=capture
What does `read()` return?
- [ ] 2 :: The lambda captures the variable, not a copy of its value when it was created.
- [x] 5 :: `read` refers to the captured `count` variable. The assignment changes that variable before the callback runs.
- [ ] The code does not compile :: A lambda can capture a local variable from its surrounding scope.
:::

## Transform items {modification}

Apply the supplied function once to each item in order and return a new list. An empty input returns an empty list without invoking the function.

@task delegates-transform

## Visit items {independent}

Call the supplied action once for each item, in order. An empty input makes no calls.

@task delegates-visit

## Make a counter {independent}

Return a function that increments its own captured count and then returns it. Each call to `Counter` must create an independent counter. Do not use static state.

@task delegates-counter
