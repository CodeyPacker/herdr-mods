string? owner = null;
Console.WriteLine(owner ?? "Unassigned");
Console.WriteLine(owner?.Length ?? 0);

string? blank = "";
Console.WriteLine((blank ?? "Unassigned") == "");

int? due = null;
Console.WriteLine(due.HasValue);
due = 0;
Console.WriteLine(due ?? -1);
