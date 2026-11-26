public class UrgentCard : Card
{
    public int Hours { get; }

    public UrgentCard(string title, int hours) : base(title)
    {
        Hours = hours;
    }

    public override string Label() => base.Label() + " (within " + Hours + " h)";
}

public static class Cards
{
    public static List<string> Labels(List<Card> cards)
    {
        var labels = new List<string>();
        for (int i = 0; i < cards.Count; i++)
        {
            labels.Add(cards[i].Label());
        }
        return labels;
    }
}
