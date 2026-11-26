TaskCard card = new TaskCard("Pack", 30);
TaskCard same = card;
same.Rename("Pack boxes");
Console.WriteLine(card.Title);
Console.WriteLine(card.Describe());

class TaskCard
{
    public string Title { get; private set; }
    public int Minutes { get; }

    public TaskCard(string title, int minutes)
    {
        Title = title;
        Minutes = minutes;
    }

    public void Rename(string title)
    {
        Title = title;
    }

    public string Describe()
    {
        return $"{Title} ({Minutes} min)";
    }
}
