bool AtLimit(int count, int limit)
{
    return count > limit;
}

Console.WriteLine(AtLimit(4, 3));
Console.WriteLine(AtLimit(3, 3));
Console.WriteLine(AtLimit(2, 3));
