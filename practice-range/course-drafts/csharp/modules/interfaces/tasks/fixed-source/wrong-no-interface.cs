public class FixedSource
{
    public List<string> Items { get; }

    public FixedSource(List<string> titles)
    {
        Items = titles;
    }

    public string Name => "fixed";

    public List<string> Titles()
    {
        return Items;
    }
}
