if (owner == "" && count == 0)
{
    Console.WriteLine("Unassigned: none");
}
else if (owner == "")
{
    Console.WriteLine($"Unassigned: {count}");
}
else if (count == 0)
{
    Console.WriteLine($"{owner}: none");
}
else
{
    Console.WriteLine($"{owner}: {count}");
}
