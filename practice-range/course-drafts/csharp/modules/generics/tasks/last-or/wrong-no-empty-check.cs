public static T LastOr<T>(List<T> items, T fallback)
{
    return items[items.Count - 1];
}
