public static Func<int> Counter(int start)
{
    int count = start;
    return () => count;
}
