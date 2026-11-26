T FirstOr<T>(List<T> items, T fallback)
{
    if (items.Count == 0)
    {
        return fallback;
    }
    return items[0];
}

int number = FirstOr(new List<int> { 4, 9 }, 0);
string title = FirstOr(new List<string>(), "none");
Console.WriteLine(number + 1);
Console.WriteLine(title.Length);

Pair<string> pair = new Pair<string>("Pack", "Ship");
Console.WriteLine(pair.Second);

record Pair<T>(T First, T Second);
