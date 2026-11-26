public class FlatEstimate : IEstimate
{
    public FlatEstimate(int minutes)
    {
    }

    public int Minutes()
    {
        return 0;
    }
}

public class ItemEstimate : IEstimate
{
    public ItemEstimate(int items, int minutesEach)
    {
    }

    public int Minutes()
    {
        return 0;
    }
}

public static class Estimates
{
    public static int Total(List<IEstimate> estimates)
    {
        return 0;
    }
}
