public static string Caption(Entry entry) => entry switch
{
    Ready r => $"{r.Title} ({r.Minutes} min)",
    _ => entry.Title,
    Blocked b => $"{b.Title} blocked: {b.Reason}"
};
