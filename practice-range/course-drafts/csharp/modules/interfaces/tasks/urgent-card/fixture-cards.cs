// Supplied base class.
public class Card
{
    public string Title { get; }

    public Card(string title)
    {
        Title = title;
    }

    public virtual string Label()
    {
        return Title;
    }
}
