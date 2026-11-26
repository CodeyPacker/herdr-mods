bool Check(Func<int, int, bool> candidate)
{
    return candidate(3, 3) == true && candidate(2, 3) == false;
}

Console.WriteLine(Check((count, limit) => count >= limit));
Console.WriteLine(Check((count, limit) => count > limit));
