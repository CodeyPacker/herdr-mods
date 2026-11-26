public static double Average(List<int> minutes)
{
    double total = 0;
    foreach (int value in minutes)
    {
        total = total + value;
    }
    return total / minutes.Count;
}
