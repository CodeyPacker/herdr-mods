TaskItem first = new TaskItem(1, "Pack", false);
TaskItem done = first with { Done = true };
Console.WriteLine(first.Done);
Console.WriteLine(done.Done);
Console.WriteLine(done.Title);

record TaskItem(int Id, string Title, bool Done);
