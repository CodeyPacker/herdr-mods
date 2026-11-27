public class FixedSource : ISongSource
{
    private List<string> Kept { get; }

    public FixedSource(List<string> titles)
    {
        Kept = new List<string>(titles);
    }

    public string Name { get; } = "fixed";

    public List<string> Titles() => new List<string>(Kept);
}
