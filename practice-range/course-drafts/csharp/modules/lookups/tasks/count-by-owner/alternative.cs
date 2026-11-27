public static Dictionary<string, int> CountVotes(List<string> votes)
{
    var counts = new Dictionary<string, int>();
    foreach (string vote in votes)
    {
        counts.TryGetValue(vote, out int current);
        counts[vote] = current + 1;
    }
    return counts;
}
