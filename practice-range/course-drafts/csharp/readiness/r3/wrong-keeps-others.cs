public static List<string> Summaries(List<Update> updates)
{
    List<string> lines = new List<string>();
    foreach (Update update in updates)
    {
        if (update is Finished { Minutes: < 0 })
        {
            throw new ArgumentException("Minutes cannot be negative.");
        }
        lines.Add(update switch
        {
            Arrived a => $"{a.Count} arrived",
            Finished f => $"{f.Title}: {f.Minutes} min",
            _ => "other"
        });
    }
    return lines;
}
