public class UrgentNotice : Notice
{
    public int Hours { get; }

    public UrgentNotice(string title, int hours) : base(title)
    {
        Hours = hours;
    }

    public override string Label()
    {
        return $"{Title} (within {Hours} h)";
    }
}

public static class Notices
{
    public static List<string> Labels(List<Notice> notices)
    {
        List<string> labels = new List<string>();
        foreach (Notice notice in notices)
        {
            labels.Add(notice.Label());
        }
        return labels;
    }
}
