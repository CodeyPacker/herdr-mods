public class UrgentNotice : Notice
{
    public int Hours { get; }

    public UrgentNotice(string title, int hours) : base(title)
    {
        Hours = hours;
    }

    public override string Label() => base.Label() + " (within " + Hours + " h)";
}

public static class Notices
{
    public static List<string> Labels(List<Notice> notices)
    {
        var labels = new List<string>();
        for (int i = 0; i < notices.Count; i++)
        {
            labels.Add(notices[i].Label());
        }
        return labels;
    }
}
