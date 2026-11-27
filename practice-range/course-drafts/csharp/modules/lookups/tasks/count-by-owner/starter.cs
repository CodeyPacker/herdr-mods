public static Dictionary<string, int> CountVotes(List<string> votes)
{
    Dictionary<string, int> counts = new Dictionary<string, int>();
    foreach (string vote in votes)
    {
        counts[vote] = 1;
    }
    return counts;
}
