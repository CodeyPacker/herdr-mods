public static int MinutesFor(Dictionary<string, int> minutes, string title)
{
    minutes.TryGetValue(title, out int found);
    if (found == 0)
    {
        return -1;
    }
    return found;
}
