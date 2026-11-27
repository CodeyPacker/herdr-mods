if (player == "" && score == 0)
{
    Console.WriteLine("Guest: none");
}
else if (player == "")
{
    Console.WriteLine($"Guest: {score}");
}
else if (score == 0)
{
    Console.WriteLine($"{player}: none");
}
else
{
    Console.WriteLine($"{player}: {score}");
}
