List<TaskItem> tasks = new List<TaskItem>
{
    new TaskItem("Pack", "Ana", true),
    new TaskItem("Ship", "Ben", false),
    new TaskItem("Label", "Ana", false),
};

var open = tasks.Where(task => !task.Done);
Console.WriteLine(open.Count());
Console.WriteLine(string.Join(", ", open.Select(task => task.Title)));

foreach (var group in tasks.GroupBy(task => task.Owner))
{
    Console.WriteLine($"{group.Key}: {group.Count()}");
}

record TaskItem(string Title, string Owner, bool Done);
