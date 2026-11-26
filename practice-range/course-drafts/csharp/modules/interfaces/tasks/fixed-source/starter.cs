public class FixedSource : ITaskSource
{
    public FixedSource(List<string> titles)
    {
    }

    public string Name => "";

    public List<string> Titles()
    {
        return new List<string>();
    }
}
