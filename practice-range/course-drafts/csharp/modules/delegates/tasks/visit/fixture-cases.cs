public static class Given
{
    public static bool VisitOrder(Action<List<string>, Action<string>> candidate)
    {
        List<string> items = new List<string> { "west", "north", "east" };
        List<string> seen = new List<string>();
        candidate(items, item => seen.Add(item));
        return seen.Count == 3 && seen[0] == "west" && seen[1] == "north" && seen[2] == "east";
    }

    public static bool VisitEmpty(Action<List<string>, Action<string>> candidate)
    {
        int emptyCalls = 0;
        candidate(new List<string>(), item => emptyCalls++);
        return emptyCalls == 0;
    }
}
