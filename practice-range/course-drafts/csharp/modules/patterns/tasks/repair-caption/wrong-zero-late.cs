public static string Caption(Entry entry) => entry switch
{
    Ready r => $"{r.Title} ({r.Minutes} min)",
    Ready { Minutes: 0 } r => $"{r.Title} (no estimate)",
    Blocked b => $"{b.Title} blocked: {b.Reason}",
    _ => entry.Title
};
