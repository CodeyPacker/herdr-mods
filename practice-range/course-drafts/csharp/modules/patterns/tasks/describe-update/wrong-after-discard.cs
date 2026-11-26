public static string Describe(Update update) => update switch
{
    Arrived a => $"{a.Count} arrived",
    Finished f => $"{f.Title} took {f.Minutes} min",
    _ => "Other",
    Paused p => $"Paused: {p.Reason}"
};
