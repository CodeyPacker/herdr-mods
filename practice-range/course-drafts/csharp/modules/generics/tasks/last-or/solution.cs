public static T LastOr<T>(List<T> items, T fallback)
{
    if (items.Count == 0)
    {
        return fallback;
    }
    return items[items.Count - 1];
}
