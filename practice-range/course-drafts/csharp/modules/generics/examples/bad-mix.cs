T FirstOr<T>(List<T> items, T fallback)
{
    if (items.Count == 0)
    {
        return fallback;
    }
    return items[0];
}

int number = FirstOr(new List<int> { 4, 9 }, "none");
Console.WriteLine(number);
