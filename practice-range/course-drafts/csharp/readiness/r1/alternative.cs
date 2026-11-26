public static int FinalCount(int start, List<int> changes)
{
    for (int i = 0; i < changes.Count; i++)
    {
        if (changes[i] < 0)
        {
            continue;
        }
        start += changes[i];
    }
    return start;
}

public static double AverageChange(List<int> changes)
{
    int total = 0;
    for (int i = 0; i < changes.Count; i++)
    {
        total += changes[i];
    }
    return changes.Count > 0 ? (double)total / changes.Count : 0;
}
