public static int FinalCount(int start, List<int> changes)
{
    int total = start;
    foreach (int change in changes)
    {
        if (change >= 0)
        {
            total = total + change;
        }
    }
    return total;
}

public static double AverageChange(List<int> changes)
{
    if (changes.Count == 0)
    {
        return 0;
    }
    double total = 0;
    foreach (int change in changes)
    {
        total = total + change;
    }
    return total / changes.Count;
}
