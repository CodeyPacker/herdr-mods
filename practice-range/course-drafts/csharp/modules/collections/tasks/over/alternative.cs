public static List<int> Over(int[] minutes, int limit)
{
    var result = new List<int>();
    for (int i = 0; i < minutes.Length; i++)
    {
        if (minutes[i] <= limit)
        {
            continue;
        }
        result.Add(minutes[i]);
    }
    return result;
}
