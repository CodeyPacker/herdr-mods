public class UrgentCard : Card
{
    public int Hours { get; }

    public UrgentCard(string title, int hours) : base(title)
    {
        Hours = hours;
    }

    public override string Label()
    {
        return $"{Title} (within {Hours} h)";
    }
}

public static class Cards
{
    public static List<string> Labels(List<Card> cards)
    {
        List<string> labels = new List<string>();
        foreach (Card card in cards)
        {
            labels.Add(card.Label());
        }
        return labels;
    }
}
