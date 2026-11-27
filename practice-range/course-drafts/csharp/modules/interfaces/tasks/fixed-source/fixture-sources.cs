// Supplied contract, and a method that works with any song source.
public interface ISongSource
{
    string Name { get; }
    List<string> Titles();
}

public static class Sources
{
    public static int Total(List<ISongSource> sources)
    {
        int total = 0;
        foreach (ISongSource source in sources)
        {
            total = total + source.Titles().Count;
        }
        return total;
    }
}
