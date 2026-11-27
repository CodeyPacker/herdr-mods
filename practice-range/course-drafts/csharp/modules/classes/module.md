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
- `public int Pages { get; }` can be set only in the constructor.
- A property can work out its value each time it is read: `public bool Long => Pages > 500;`
- The **constructor** has the same name as the class. It runs once, when the object is created, and gives the properties their first values.
- A method without `static` belongs to one object and uses that object's own properties.

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

## Two names, one object {prediction}

`same` is assigned from `book`, then the book is renamed through `same`. Predict the first line of output.

@example card

:::question predict-shared example=card
What is the first line of output?
- [ ] Dune :: `same` and `book` refer to the same object, so the rename is visible through `book`.
- [x] Dune Messiah :: Assigning a class variable copies the reference, not the object. Both names see the rename.
- [ ] Dune Messiah (400 pages) :: The first print shows only the `Title`. `Describe` is called on the next line.
:::

## Follow the reference {walkthrough}

`Book same = book;` does not copy the object. A class variable holds a **reference** to an object, and the assignment copies that reference.

- `book` and `same` now refer to one object, so a change made through `same` is visible through `book`.
- This differs from `int`, where assignment copies the number itself.
- `Describe` then reads the current `Title` and `Pages` of that one object.

@example card

## Change a get-only property {prediction}

Line 2 assigns to a property that has only `get`. Read the example before checking.

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
What happens when you check this example?
- [x] The compiler reports an error on line 2. :: `Pages` has only `get`, so code outside the constructor cannot assign to it (CS0200).
- [ ] It prints 450. :: `Pages` has no `set`. The compiler rejects the assignment.
- [ ] It prints 400, because the assignment is ignored. :: An assignment that is not allowed is a compile error. It is never silently skipped.
:::

## Read the compiler error {walkthrough}

Check the example. **CS0200** says the property cannot be assigned because it is read only. `Pages` has no `set`, so only the constructor can give it a value.

This is deliberate: the class decides which changes are allowed, and other code has to go through its methods.

@example bad-set

## Finish the bus class {modification}

The starter has the properties and the constructor. Fill in the two empty methods.

@task classes-board

## Write a book class {independent}

Work from the prompt. The starter has the member names, and the bodies are yours.

@task classes-task-card
