public static List<int> Over(int[] minutes, int limit)
{
    List<int> result = new List<int>();
    for (int i = 0; i < minutes.Length; i++)
    {
        if (minutes[i] > limit)
        {
            result.Add(i);
        }
    }
    return result;
}
