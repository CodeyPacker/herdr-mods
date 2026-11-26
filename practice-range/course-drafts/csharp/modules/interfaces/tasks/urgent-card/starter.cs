public class UrgentCard : Card
{
    public int Hours { get; }

    public UrgentCard(string title, int hours) : base(title)
    {
    }
}

public static class Cards
{
    public static List<string> Labels(List<Card> cards)
    {
        return new List<string>();
    }
}
