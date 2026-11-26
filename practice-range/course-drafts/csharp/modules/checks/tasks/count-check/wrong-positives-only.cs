public static bool CountCheck(Func<List<int>, int> candidate)
{
    return candidate(new List<int> { 1, 2 }) == 2;
}
