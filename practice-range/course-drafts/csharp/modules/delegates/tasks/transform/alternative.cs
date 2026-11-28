public static List<int> Transform(List<int> items, Func<int, int> convert)
{
    List<int> result = new List<int>();
    for (int i = 0; i < items.Count; i++)
    {
        int changed = convert(items[i]);
        result.Add(changed);
    }
    return result;
}
