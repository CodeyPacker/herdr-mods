public static bool CountCheck(Func<List<int>, int> candidate)
{
    return candidate(new List<int> { 3, 0, 5 }) == 3;
}
