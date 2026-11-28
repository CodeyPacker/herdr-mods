public static class Given
{
    public static bool TransformValues(Func<List<int>, Func<int, int>, List<int>> candidate)
    {
        List<int> input = new List<int> { 3, 1, 2 };
        List<int> result = candidate(input, value => value + 10);
        if (result.Count != 3 || result[0] != 13 || result[1] != 11 || result[2] != 12) return false;
        List<int> negatives = candidate(new List<int> { 4, -2 }, value => -value);
        return negatives.Count == 2 && negatives[0] == -4 && negatives[1] == 2;
    }

    public static bool TransformCalls(Func<List<int>, Func<int, int>, List<int>> candidate)
    {
        List<int> input = new List<int> { 3, 1, 2 };
        List<int> seen = new List<int>();
        int calls = 0;
        candidate(input, value => { calls++; seen.Add(value); return value; });
        return calls == 3 && seen.Count == 3 && seen[0] == 3 && seen[1] == 1 && seen[2] == 2;
    }

    public static bool TransformOwnList(Func<List<int>, Func<int, int>, List<int>> candidate)
    {
        List<int> input = new List<int> { 3, 1, 2 };
        List<int> result = candidate(input, value => value + 1);
        return !Object.ReferenceEquals(input, result) && input.Count == 3 && input[0] == 3 && input[1] == 1 && input[2] == 2;
    }

    public static bool TransformEmpty(Func<List<int>, Func<int, int>, List<int>> candidate)
    {
        int emptyCalls = 0;
        List<int> emptyResult = candidate(new List<int>(), value => { emptyCalls++; return value; });
        return emptyCalls == 0 && emptyResult.Count == 0;
    }
}
