public static string Caption(Entry entry) => entry switch
{
    Ready r => $"{r.Title} ({r.Minutes} min)",
    Blocked b => $"{b.Title} blocked: {b.Reason}",
    _ => entry.Title
};
