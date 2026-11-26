public static T LastOr<T>(List<T> items, T fallback)
{
    T last = fallback;
    foreach (T item in items)
    {
        last = item;
    }
    return last;
}
