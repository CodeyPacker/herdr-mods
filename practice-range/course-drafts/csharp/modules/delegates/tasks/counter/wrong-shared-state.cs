private static int count;

public static Func<int> Counter(int start)
{
    count = start;
    return () => ++count;
}
