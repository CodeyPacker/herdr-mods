public static int UniqueVisitors(List<string> visitors)
{
    HashSet<string> seen = new HashSet<string>();
    foreach (string visitor in visitors)
    {
        if (visitor != "")
        {
            seen.Add(visitor);
        }
    }
    return seen.Count;
}
