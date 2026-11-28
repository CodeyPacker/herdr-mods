---
id: course:cs-foundations/module/interfaces
title: Interfaces and inheritance
requires: ["class","property","constructor","method","parameter-return","record","list","loop","interpolation"]
outcomes: [{"id":"implement","can":"Implement an interface and use the type through it.","assessment":["predict-missing","course:cs-foundations/task/interfaces-fixed-source"]},{"id":"override","can":"Extend a class and override a method so the right version runs.","assessment":["predict-dispatch","course:cs-foundations/task/interfaces-urgent-card"]},{"id":"transfer","can":"Write two types behind one interface and a method that works with both.","assessment":["course:cs-foundations/task/interfaces-estimates"]}]
tasks: [{"id":"course:cs-foundations/task/interfaces-fixed-source","path":"tasks/fixed-source/task.json"},{"id":"course:cs-foundations/task/interfaces-urgent-card","path":"tasks/urgent-card/task.json"},{"id":"course:cs-foundations/task/interfaces-estimates","path":"tasks/estimates/task.json"}]
review: {"task":"course:cs-foundations/task/interfaces-estimates","afterModule":"course:cs-foundations/module/generics","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted."}
drills: ["classes/interface","classes/inherit","classes/override","constructors/base"]
drillGap: These drills practise one declaration each. They do not call a method through a base-type variable.
---

Different types can often be used the same way: several places to read items from, several kinds of notice. Prefer an interface when types need interchangeable behavior. Use inheritance when one type is genuinely a kind of another, not only to reuse code. A contained helper object is composition. This module covers interfaces and inheritance.

## An interface is a contract

An **interface** declares required members here. Modern C# also supports default implementations in interfaces, but this course does not use them. `interface ISource` says that any source has a `Name` and a `Count` method.

- A class takes on the contract by naming the interface after a colon, as in `class FixedSource : ISource`, and must then provide every member. Having matching members is not enough: the class has to name the interface.
- A variable of type `ISource` can hold any object whose class implements it. Code written against `ISource` works with all of them, including classes written later. A loop over a `List<ISource>` calls each object's own `Name` and `Count` without knowing its class.


## A class can build on another

`class UrgentNotice : Notice` makes `UrgentNotice` a kind of `Notice`. It gets `Title` and `Text` from `Notice` (**inheritance**).

- `: base(title)` after the constructor passes the title on to `Notice`'s constructor.
- A method marked `virtual` in the base class may be replaced, and the derived class replaces it with `override`.
- Without `override`, a method with the same name only hides the base one, and a call through a `Notice` variable runs the base version.
- Records can inherit the same way: `record Arrived(int Count) : Update;`
- A type marked `abstract` cannot be created itself. It exists only to be inherited from.

## Which Text runs? {prediction}

`notice` is declared as a `Notice` but holds an `UrgentNotice`. Predict the last line of output.

```csharp example sources
List<ISource> sources = new List<ISource> { new FixedSource(3), new EmptySource() };
foreach (ISource source in sources)
{
    Console.WriteLine($"{source.Name}: {source.Count()}");
}

Notice notice = new UrgentNotice("Storm");
Console.WriteLine(notice.Text());

interface ISource
{
    string Name { get; }
    int Count();
}

class FixedSource : ISource
{
    public int Size { get; }

    public FixedSource(int size)
    {
        Size = size;
    }

    public string Name => "fixed";
    public int Count() => Size;
}

class EmptySource : ISource
{
    public string Name => "empty";
    public int Count() => 0;
}

class Notice
{
    public string Title { get; }

    public Notice(string title)
    {
        Title = title;
    }

    public virtual string Text() => Title;
}

class UrgentNotice : Notice
{
    public UrgentNotice(string title) : base(title)
    {
    }

    public override string Text() => $"{Title}!";
}

```

```output
fixed: 3
empty: 0
Storm!
```

:::question predict-dispatch example=sources
What is the last line of output?
- [ ] Storm :: `Text` is `virtual` and `UrgentNotice` overrides it, so the object's own version runs.
- [x] Storm! :: The variable's type is `Notice`, but the object is an `UrgentNotice`. With `virtual` and `override`, the object's own version runs, whatever the variable's type. The loop above works the same way through `ISource`.
- [ ] The compiler reports an error :: An `UrgentNotice` is a `Notice`, so the assignment is allowed.
:::

## Find the error {prediction}

This example does not compile. Find the line the compiler stops at, and why.

```csharp example missing-member diagnostics=[{"code":535,"line":10}]
ISource source = new EmptySource();
Console.WriteLine(source.Name);

interface ISource
{
    string Name { get; }
    int Count();
}

class EmptySource : ISource
{
    public string Name => "empty";
}

```

:::question predict-missing example=missing-member
Which error does the compiler report?
- [ ] Line 1: a variable of an interface type cannot hold an object. :: That is exactly what an interface variable is for. Line 1 is fine.
- [ ] Line 2: `Name` cannot be read through an `ISource` variable. :: `ISource` declares `Name`, so any `ISource` variable can read it.
- [x] Line 10, CS0535: `EmptySource` names `ISource` but has no `Count`. :: The error is on the line that names the interface, because that is where the promise was made. It is found at compile time, so nothing runs, even though line 2 never calls `Count`.
:::

## Finish a song source {modification}

The case box supplies the interface and a method that uses it. Finish the class so it keeps what it is given.

@task interfaces-fixed-source

## Add an urgent notice {independent}

Work from the prompt. One check calls your method through a variable of the base type.

@task interfaces-urgent-card
