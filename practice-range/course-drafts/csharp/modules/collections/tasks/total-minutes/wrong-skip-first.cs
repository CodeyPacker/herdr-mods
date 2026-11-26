public static int TotalMinutes(int[] minutes)
{
    int total = 0;
    for (int i = 1; i < minutes.Length; i++)
    {
        total = total + minutes[i];
    }
    return total;
}
