public static int UniqueVisitors(List<string> visitors)
{
    List<string> seen = new List<string>();
    foreach (string visitor in visitors)
    {
        if (visitor == "" || seen.Contains(visitor))
        {
            continue;
        }
        seen.Add(visitor);
    }
    return seen.Count;
}
