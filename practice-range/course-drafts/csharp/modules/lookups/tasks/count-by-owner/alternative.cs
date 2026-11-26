public static Dictionary<string, int> CountByOwner(List<string> owners)
{
    var counts = new Dictionary<string, int>();
    foreach (string owner in owners)
    {
        counts.TryGetValue(owner, out int current);
        counts[owner] = current + 1;
    }
    return counts;
}
