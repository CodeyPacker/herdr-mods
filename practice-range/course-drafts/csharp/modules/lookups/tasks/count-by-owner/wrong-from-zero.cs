public static Dictionary<string, int> CountByOwner(List<string> owners)
{
    Dictionary<string, int> counts = new Dictionary<string, int>();
    foreach (string owner in owners)
    {
        if (counts.ContainsKey(owner))
        {
            counts[owner] = counts[owner] + 1;
        }
        else
        {
            counts[owner] = 0;
        }
    }
    return counts;
}
