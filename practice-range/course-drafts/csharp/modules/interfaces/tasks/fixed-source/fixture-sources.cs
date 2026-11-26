// Supplied contract, and a method that works with any task source.
public interface ITaskSource
{
    string Name { get; }
    List<string> Titles();
}

public static class Sources
{
    public static int Total(List<ITaskSource> sources)
    {
        int total = 0;
        foreach (ITaskSource source in sources)
        {
            total = total + source.Titles().Count;
        }
        return total;
    }
}
