TaskCard card = new TaskCard("Pack", 30);
card.Minutes = 45;
Console.WriteLine(card.Minutes);

class TaskCard
{
    public string Title { get; private set; }
    public int Minutes { get; }

    public TaskCard(string title, int minutes)
    {
        Title = title;
        Minutes = minutes;
    }
}
