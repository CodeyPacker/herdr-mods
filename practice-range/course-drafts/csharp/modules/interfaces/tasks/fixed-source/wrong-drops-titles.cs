public class FixedSource : ISongSource
{
    public FixedSource(List<string> titles)
    {
    }

    public string Name => "fixed";

    public List<string> Titles()
    {
        return new List<string>();
    }
}
