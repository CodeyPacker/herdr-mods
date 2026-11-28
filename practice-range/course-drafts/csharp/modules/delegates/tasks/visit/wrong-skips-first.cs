public static void Visit(List<string> items, Action<string> emit)
{
    for (int i = 1; i < items.Count; i++) emit(items[i]);
}
