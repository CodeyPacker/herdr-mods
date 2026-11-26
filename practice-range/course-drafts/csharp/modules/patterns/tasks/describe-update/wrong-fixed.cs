public static string Describe(Update update) => update switch
{
    Arrived a => $"{a.Count} arrived",
    Finished f => "Pack took 15 min",
    Paused p => $"Paused: {p.Reason}",
    _ => "Other"
};
