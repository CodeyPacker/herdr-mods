---
id: course:cs-foundations/module/classes
title: Classes and properties
requires: ["method","parameter-return","scope","variable","text","interpolation","branch","comparison","list","loop"]
outcomes: [{"id":"trace","can":"Predict what two variables for one object share.","assessment":["predict-shared","course:cs-foundations/task/classes-board"]},{"id":"protect","can":"Say which code may change a property, and read the error when other code tries.","assessment":["predict-readonly"]},{"id":"write","can":"Write a class with a constructor, properties and methods.","assessment":["course:cs-foundations/task/classes-task-card"]},{"id":"transfer","can":"Return a new object and leave the one you were given unchanged.","assessment":["course:cs-foundations/task/classes-emphasize"]}]
tasks: [{"id":"course:cs-foundations/task/classes-board","path":"tasks/board/task.json"},{"id":"course:cs-foundations/task/classes-task-card","path":"tasks/task-card/task.json"},{"id":"course:cs-foundations/task/classes-emphasize","path":"tasks/emphasize/task.json"}]
review: {"task":"course:cs-foundations/task/classes-emphasize","afterModule":"course:cs-foundations/module/lookups","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted."}
drills: ["classes/auto-property","classes/get-only","classes/private-set","classes/instance-method","constructors/assign"]
drillGap: These drills practise one member form each. They do not check a sequence of calls on one object.
---

A **class** groups data with the methods that work on it. This module covers properties, constructors and instance methods, and what happens when two variables refer to the same object.

## A class is a blueprint

A class describes one kind of thing. `new Book("Dune", 400)` creates an **object** from it.

- A **property** is a named value on each object. `public string Title { get; private set; }` can be read by any code and changed only inside the class.
- `public int Pages { get; }` is a get-only auto-property. It can be initialized at its declaration or in the constructor, then read but not reassigned.
- A property can work out its value each time it is read: `public bool Long => Pages > 500;`
- The **constructor** has the same name as the class. It runs once, when the object is created, and gives the properties their first values.
- A method without `static` belongs to one object and uses that object's own properties.


## Fields, access and static

A **field** stores data directly, as in `private int visits;`. A property exposes reads or writes through `get` and `set`, and can validate or compute a value. `private` limits access to the containing type. `public` allows access from other code. `protected` also allows derived classes to access a member.

An instance member uses one object's data, such as `book.Title`. A `static` member belongs to the type, such as `Math.Max(3, 5)`. A static method has no current object, so it needs an object passed in before it can read that object's instance members. `this` refers to the current object inside an instance member.

## Two names, one object {prediction}

`same` is assigned from `book`, then the book is renamed through `same`. Predict the first line of output.

```csharp example card
Book book = new Book("Dune", 400);
Book same = book;
same.Rename("Dune Messiah");
Console.WriteLine(book.Title);
Console.WriteLine(book.Describe());

class Book
{
    public string Title { get; private set; }
    public int Pages { get; }

    public Book(string title, int pages)
    {
        Title = title;
        Pages = pages;
    }

    public void Rename(string title)
    {
        Title = title;
    }

    public string Describe()
    {
        return $"{Title} ({Pages} pages)";
    }
}
```

```output
Dune Messiah
Dune Messiah (400 pages)
```

:::question predict-shared example=card
What is the first line of output?
- [ ] Dune :: `same` and `book` refer to the same object, so the rename is visible through `book`.
- [x] Dune Messiah :: A class variable holds a **reference** to an object. `Book same = book;` copies that reference, not the object, so both names refer to one book and see the rename. An `int` is different: assigning it copies the number itself.
- [ ] Dune Messiah (400 pages) :: The first print shows only the `Title`. `Describe` is called on the next line.
:::

## Find the error {prediction}

This example does not compile. Find the line the compiler stops at, and why.

```csharp example bad-set diagnostics=[{"code":200,"line":2}]
Book book = new Book("Dune", 400);
book.Pages = 450;
Console.WriteLine(book.Pages);

class Book
{
    public string Title { get; private set; }
    public int Pages { get; }

    public Book(string title, int pages)
    {
        Title = title;
        Pages = pages;
    }
}
```

:::question predict-readonly example=bad-set
Which error does the compiler report?
- [ ] Line 1: the constructor needs the property names, as in `Title: "Dune"`. :: The constructor takes its values in order, so `new Book("Dune", 400)` is fine.
- [x] Line 2, CS0200: `Pages` has only `get`, so it cannot be assigned there. :: A get-only auto-property can be initialized at its declaration or in its constructor, but not by this caller. That is deliberate: the class decides which changes are allowed, and other code goes through its methods, the way `Rename` changes `Title`.
- [ ] Line 3: a property cannot be printed directly. :: `book.Pages` is an `int` and prints like any other. The compiler stops at line 2.
:::

## Finish the bus class {modification}

The starter has the properties and the constructor. Fill in the two empty methods.

@task classes-board

## Write a book class {independent}

Work from the prompt. Declare the class and its members yourself. The prompt gives the contract, and the checks call your public members.

@task classes-task-card
