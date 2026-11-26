public static List<string> Summaries(List<Update> updates)
{
    List<string> lines = new List<string>();
    foreach (Update update in updates)
    {
        if (update is Arrived a)
        {
            lines.Add($"{a.Count} arrived");
        }
        else if (update is Finished f && f.Minutes >= 0)
        {
            lines.Add($"{f.Title}: {f.Minutes} min");
        }
    }
    return lines;
}
