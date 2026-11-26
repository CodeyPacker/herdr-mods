public static List<int> Over(int[] minutes, int limit)
{
    List<int> result = new List<int>();
    foreach (int value in minutes)
    {
        if (value >= limit)
        {
            result.Add(value);
        }
    }
    return result;
}
