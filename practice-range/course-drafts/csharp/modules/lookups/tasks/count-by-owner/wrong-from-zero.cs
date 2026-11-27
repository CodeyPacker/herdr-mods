public static Dictionary<string, int> CountVotes(List<string> votes)
{
    Dictionary<string, int> counts = new Dictionary<string, int>();
    foreach (string vote in votes)
    {
        if (counts.ContainsKey(vote))
        {
            counts[vote] = counts[vote] + 1;
        }
        else
        {
            counts[vote] = 0;
        }
    }
    return counts;
}
