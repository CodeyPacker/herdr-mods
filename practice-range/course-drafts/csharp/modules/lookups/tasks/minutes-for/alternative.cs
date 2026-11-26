public static int MinutesFor(Dictionary<string, int> minutes, string title)
{
    if (!minutes.ContainsKey(title))
    {
        return -1;
    }
    return minutes[title];
}
