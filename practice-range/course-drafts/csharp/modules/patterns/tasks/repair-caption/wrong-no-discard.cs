public static string Caption(Entry entry) => entry switch
{
    Ready { Minutes: 0 } r => $"{r.Title} (no estimate)",
    Ready r => $"{r.Title} ({r.Minutes} min)",
    Blocked b => $"{b.Title} blocked: {b.Reason}"
};
