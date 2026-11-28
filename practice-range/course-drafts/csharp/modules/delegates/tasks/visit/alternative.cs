public static void Visit(List<string> items, Action<string> emit)
{
    for (int i = 0; i < items.Count; i++)
    {
        string current = items[i];
        emit(current);
    }
}
