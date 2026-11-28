public static List<int> Transform(List<int> items, Func<int, int> convert)
{
    List<int> result = new List<int>();
    if (items.Count == 0) return result;
    int first = convert(items[0]);
    for (int i = 0; i < items.Count; i++) result.Add(first);
    return result;
}
