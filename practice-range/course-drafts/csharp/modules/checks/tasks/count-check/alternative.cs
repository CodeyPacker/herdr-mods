public static bool CountCheck(Func<List<int>, int> candidate)
{
    bool zeroIgnored = candidate(new List<int> { 0 }) == 0;
    bool negativeIgnored = candidate(new List<int> { 1, -1 }) == 1;
    return zeroIgnored && negativeIgnored;
}
