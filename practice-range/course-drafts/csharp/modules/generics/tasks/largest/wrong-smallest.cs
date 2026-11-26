public static T Largest<T>(List<T> items, T fallback) where T : IComparable<T>
{
    if (items.Count == 0)
    {
        return fallback;
    }
    T best = items[0];
    foreach (T item in items)
    {
        if (item.CompareTo(best) < 0)
        {
            best = item;
        }
    }
    return best;
}
