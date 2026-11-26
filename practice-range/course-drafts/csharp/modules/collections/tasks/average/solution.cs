public static double Average(List<int> minutes)
{
    if (minutes.Count == 0)
    {
        return 0;
    }
    double total = 0;
    foreach (int value in minutes)
    {
        total = total + value;
    }
    return total / minutes.Count;
}
