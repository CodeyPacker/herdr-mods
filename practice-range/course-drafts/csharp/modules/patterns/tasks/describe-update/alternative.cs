public static string Describe(Update update)
{
    if (update is Arrived a) return $"{a.Count} arrived";
    if (update is Finished f) return f.Title + " took " + f.Minutes + " min";
    if (update is Paused p) return "Paused: " + p.Reason;
    return "Other";
}
