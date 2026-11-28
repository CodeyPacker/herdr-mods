public static void Visit(List<string> items, Action<string> emit)
{
    for (int i = items.Count - 1; i >= 0; i--) emit(items[i]);
}
