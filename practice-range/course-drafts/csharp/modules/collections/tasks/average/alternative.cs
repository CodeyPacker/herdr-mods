public static double Average(List<int> minutes)
{
    int total = 0;
    for (int i = 0; i < minutes.Count; i++)
    {
        total = total + minutes[i];
    }
    if (minutes.Count > 0)
    {
        return (double)total / minutes.Count;
    }
    return 0;
}
