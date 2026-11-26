string name = owner;
if (owner == "")
{
    name = "Unassigned";
}
string amount = $"{count}";
if (count == 0)
{
    amount = "none";
}
Console.WriteLine($"{name}: {amount}");
