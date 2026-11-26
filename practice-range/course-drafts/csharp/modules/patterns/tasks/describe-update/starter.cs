public static string Describe(Update update) => update switch
{
    Arrived a => $"{a.Count} arrived",
    Finished f => "Finished",
    _ => "Other"
};
