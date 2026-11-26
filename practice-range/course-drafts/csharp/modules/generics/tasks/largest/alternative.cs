public static T Largest<T>(List<T> items, T fallback) where T : IComparable<T>
{
    T best = fallback;
    for (int i = 0; i < items.Count; i++)
    {
        if (i == 0 || best.CompareTo(items[i]) < 0)
        {
            best = items[i];
        }
    }
    return best;
}
