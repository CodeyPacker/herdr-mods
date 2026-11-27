public static int UniqueVisitors(List<string> visitors)
{
    HashSet<string> seen = new HashSet<string>();
    foreach (string visitor in visitors)
    {
        seen.Add(visitor);
    }
    return seen.Count;
}
