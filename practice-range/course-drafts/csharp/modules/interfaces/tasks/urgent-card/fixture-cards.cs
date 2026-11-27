// Supplied base class.
public class Notice
{
    public string Title { get; }

    public Notice(string title)
    {
        Title = title;
    }

    public virtual string Label()
    {
        return Title;
    }
}
