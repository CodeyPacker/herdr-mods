public static void Visit(List<string> items, Action<string> emit)
{
    foreach (string item in items) emit(item);
}
