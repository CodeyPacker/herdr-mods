public static List<int> Transform(List<int> items, Func<int, int> convert)
{
    List<int> result = new List<int>();
    foreach (int item in items) result.Add(convert(item));
    return result;
}
