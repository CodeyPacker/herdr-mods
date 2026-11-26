public class FlatEstimate : IEstimate
{
    public int Amount { get; }

    public FlatEstimate(int minutes)
    {
        Amount = minutes;
    }

    public int Minutes() => Amount;
}

public class ItemEstimate : IEstimate
{
    public int Whole { get; }

    public ItemEstimate(int items, int minutesEach)
    {
        Whole = items * minutesEach;
    }

    public int Minutes() => Whole;
}

public static class Estimates
{
    public static int Total(List<IEstimate> estimates) => estimates.Sum(estimate => estimate.Minutes());
}
