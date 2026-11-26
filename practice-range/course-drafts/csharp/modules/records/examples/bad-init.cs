Job first = new Job("Pack", 30);
first.Minutes = 45;
Console.WriteLine(first.Minutes);

record Job(string Title, int Minutes);
