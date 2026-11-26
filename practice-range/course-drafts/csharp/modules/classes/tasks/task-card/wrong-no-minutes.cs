public class TaskCard
{
    public string Title { get; }
    public int Minutes { get; }
    public bool Done { get; private set; }

    public TaskCard(string title, int minutes)
    {
        Title = title;
    }

    public void Complete()
    {
        Done = true;
    }

    public string Describe()
    {
        if (Done)
        {
            return $"{Title} (done)";
        }
        return $"{Title} ({Minutes} min)";
    }
}
