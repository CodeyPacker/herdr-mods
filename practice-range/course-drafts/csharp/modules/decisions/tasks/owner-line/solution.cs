string name = player;
if (player == "")
{
    name = "Guest";
}
string amount = $"{score}";
if (score == 0)
{
    amount = "none";
}
Console.WriteLine($"{name}: {amount}");
