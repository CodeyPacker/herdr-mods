public static class Given
{
    public static bool CounterStarts(Func<int, Func<int>> candidate)
    {
        Func<int> count = candidate(8);
        return count() == 9 && count() == 10;
    }

    public static bool CountersAreIndependent(Func<int, Func<int>> candidate)
    {
        Func<int> first = candidate(10);
        Func<int> second = candidate(0);
        return first() == 11 && second() == 1 && first() == 12 && second() == 2;
    }

    public static bool NegativeStart(Func<int, Func<int>> candidate)
    {
        Func<int> count = candidate(-2);
        return count() == -1 && count() == 0;
    }
}
