string Describe(Notice notice) => notice switch
{
    Waiting w => $"Place {w.Place}",
    Finished f => f.Title,
    _ => "Unknown"
};

Console.WriteLine(Describe(new Waiting(0)));
Console.WriteLine(Describe(new Finished("Pack")));

abstract record Notice;
record Waiting(int Place) : Notice;
record Finished(string Title) : Notice;
