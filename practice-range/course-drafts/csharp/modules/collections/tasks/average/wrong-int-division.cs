public static double Average(List<int> minutes)
{
    if (minutes.Count == 0)
    {
        return 0;
    }
    int total = 0;
    foreach (int value in minutes)
    {
        total = total + value;
    }
    return total / minutes.Count;
}
