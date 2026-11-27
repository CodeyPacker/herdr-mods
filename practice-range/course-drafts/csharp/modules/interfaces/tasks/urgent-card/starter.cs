public class UrgentNotice : Notice
{
    public int Hours { get; }

    public UrgentNotice(string title, int hours) : base(title)
    {
    }
}

public static class Notices
{
    public static List<string> Labels(List<Notice> notices)
    {
        return new List<string>();
    }
}
