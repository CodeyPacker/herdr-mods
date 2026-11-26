public static string Caption(Entry entry)
{
    if (entry is Ready r)
    {
        if (r.Minutes == 0) return $"{r.Title} (no estimate)";
        return $"{r.Title} ({r.Minutes} min)";
    }
    if (entry is Blocked b) return $"{b.Title} blocked: {b.Reason}";
    return entry.Title;
}
