public static class Given
{
    public static bool MatchesCleanTags(Func<string, List<string>> candidate, string input, params string[] expected)
    {
        List<string> actual = candidate(input);
        if (actual.Count != expected.Length) return false;
        for (int i = 0; i < expected.Length; i++)
        {
            if (actual[i] != expected[i]) return false;
        }
        return true;
    }
}
