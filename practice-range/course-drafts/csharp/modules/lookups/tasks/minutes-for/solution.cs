public static int MinutesFor(Dictionary<string, int> minutes, string title)
{
    if (minutes.TryGetValue(title, out int found))
    {
        return found;
    }
    return -1;
}
