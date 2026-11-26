public class TaskCard
{
    public string Title { get; }
    public int Minutes { get; }
    public bool Done { get; private set; }

    public TaskCard(string title, int minutes)
    {
        Title = title;
        Minutes = minutes;
    }

    public void Complete()
    {
        Done = true;
    }

    public string Describe()
    {
        return $"{Title} ({Minutes} min)";
    }
}
