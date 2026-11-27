---
id: course:cs-foundations/module/generics
title: Generics
requires: ["list","loop","method","parameter-return","record","branch","comparison","interface"]
outcomes: [{"id":"method","can":"Write a generic method that returns the caller's own type.","assessment":["predict-types","course:cs-foundations/task/generics-last-or"]},{"id":"mismatch","can":"Read the error when the types in one call do not agree.","assessment":["predict-mix"]},{"id":"type","can":"Use a generic type with different payloads.","assessment":["course:cs-foundations/task/generics-outcome"]},{"id":"transfer","can":"Use a constraint to compare values of an unknown type.","assessment":["course:cs-foundations/task/generics-largest"]}]
tasks: [{"id":"course:cs-foundations/task/generics-last-or","path":"tasks/last-or/task.json"},{"id":"course:cs-foundations/task/generics-outcome","path":"tasks/outcome/task.json"},{"id":"course:cs-foundations/task/generics-largest","path":"tasks/largest/task.json"}]
review: {"task":"course:cs-foundations/task/generics-largest","afterModule":"course:cs-foundations/module/checks","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted."}
drills: ["generics/identity","generics/box","generics/comparable","methods/generic"]
drillGap: These drills practise one generic declaration each. They do not check one method with several types.
---

A method that returns the first item of a list should work for a list of anything, and give back that same kind of thing. Generics let you write it once. This module covers generic methods, generic types and constraints.

## A type that the caller chooses

T FirstOr<T>(List<T> items, T fallback) is a generic method. T is a type parameter: a placeholder that each call fills in. Called with a List<int>, T is int, so the fallback must be an int and the result is an int. Called with a List<string>, the same code returns a string. The compiler works T out from the arguments, so you rarely write it yourself. A type can be generic too. record Pair<T>(T First, T Second) holds two values of one type, whichever type the code that uses it picks. List<T> and Dictionary<TKey, TValue> are generic types you have used already.

```csharp example first
T FirstOr<T>(List<T> items, T fallback)
{
    if (items.Count == 0)
    {
        return fallback;
    }
    return items[0];
}

int number = FirstOr(new List<int> { 4, 9 }, 0);
string title = FirstOr(new List<string>(), "none");
Console.WriteLine(number + 1);
Console.WriteLine(title.Length);

Pair<string> pair = new Pair<string>("left", "right");
Console.WriteLine(pair.Second);

record Pair<T>(T First, T Second);

```

```output
5
4
right
```

## Predict the types {prediction}

FirstOr is called once with ints and once with strings. Predict the three lines of output.

@example first

:::question predict-types example=first
What are the three lines of output?
- [ ] 4, 4, right :: The first line prints number + 1, and number is 4.
- [x] 5, 4, right :: number is 4, so 5 prints. title is "none", which has 4 characters. Second is "right".
- [ ] 5, 0, right :: The second list is empty, so title is the fallback "none", and its Length is 4.
:::

## Follow each call {walkthrough}

The first call returns 4, the first item, as an int, so number + 1 is 5. The second list is empty, so the fallback "none" comes back as a string, and its Length is 4. No conversion was needed in either case: the result has the caller's type. pair is a Pair<string>, so Second is a string.

@example first

## Mix two types in one call {prediction}

This call passes a list of ints and a string fallback. Read the example before checking.

```csharp example bad-mix diagnostics=[{"code":411,"line":10}]
T FirstOr<T>(List<T> items, T fallback)
{
    if (items.Count == 0)
    {
        return fallback;
    }
    return items[0];
}

int number = FirstOr(new List<int> { 4, 9 }, "none");
Console.WriteLine(number);

```

:::question predict-mix example=bad-mix
What happens when you check this example?
- [ ] It prints 4. :: The call does not compile, because T cannot be both int and string.
- [ ] It prints none. :: The list is not empty, and the call does not compile in any case.
- [x] The compiler reports an error on line 10. :: One call needs one T. A List<int> with a string fallback gives CS0411.
:::

## Read the compiler error {walkthrough}

Check the example. T has to be one type for the whole call. The list says int and the fallback says string, so the compiler cannot choose and reports CS0411: the type arguments cannot be inferred from the usage. The relationship between the parameters is checked before anything runs.

@example bad-mix

## Ask for an ability

Inside a generic method you know nothing about T, so you cannot compare two T values with > or call methods on them. A constraint states what T must be able to do. where T : IComparable<T> accepts only types that can be compared with themselves, which includes int and string. Then a.CompareTo(b) is allowed. It returns a number above 0 when a comes after b, 0 when they are equal, and a number below 0 when a comes before b.

## Return the last item {modification}

The starter always returns the fallback. Make it work for a list of any type.

@task generics-last-or

## Carry a result of any type {independent}

Work from the prompt. The same three methods are checked with numbers and with text.

@task generics-outcome
