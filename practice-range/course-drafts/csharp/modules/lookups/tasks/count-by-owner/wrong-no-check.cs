public static Dictionary<string, int> CountByOwner(List<string> owners)
{
    Dictionary<string, int> counts = new Dictionary<string, int>();
    foreach (string owner in owners)
    {
        counts[owner] = counts[owner] + 1;
    }
    return counts;
}
