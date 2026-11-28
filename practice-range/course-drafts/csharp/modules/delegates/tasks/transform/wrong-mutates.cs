public static List<int> Transform(List<int> items, Func<int, int> convert)
{
    for (int i = 0; i < items.Count; i++) items[i] = convert(items[i]);
    return items;
}
