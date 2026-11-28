public static Func<int> Counter(int start)
{
    int next = start;
    Func<int> increment = () => { next = next + 1; return next; };
    return increment;
}
