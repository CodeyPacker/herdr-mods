public static T Largest<T>(List<T> items, T fallback) where T : IComparable<T>
{
    T best = fallback;
    foreach (T item in items)
    {
        if (item.CompareTo(best) > 0)
        {
            best = item;
        }
    }
    return best;
}
