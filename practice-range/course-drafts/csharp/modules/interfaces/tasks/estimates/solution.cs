public class FlatEstimate : IEstimate
{
    public int Amount { get; }

    public FlatEstimate(int minutes)
    {
        Amount = minutes;
    }

    public int Minutes()
    {
        return Amount;
    }
}

public class ItemEstimate : IEstimate
{
    public int Items { get; }
    public int MinutesEach { get; }

    public ItemEstimate(int items, int minutesEach)
    {
        Items = items;
        MinutesEach = minutesEach;
    }

    public int Minutes()
    {
        return Items * MinutesEach;
    }
}

public static class Estimates
{
    public static int Total(List<IEstimate> estimates)
    {
        int total = 0;
        foreach (IEstimate estimate in estimates)
        {
            total = total + estimate.Minutes();
        }
        return total;
    }
}
