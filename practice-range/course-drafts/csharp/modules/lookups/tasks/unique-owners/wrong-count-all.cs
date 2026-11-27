public static int UniqueVisitors(List<string> visitors)
{
    int count = 0;
    foreach (string visitor in visitors)
    {
        if (visitor != "")
        {
            count = count + 1;
        }
    }
    return count;
}
