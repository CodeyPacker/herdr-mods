public class TaskCard
{
    public string Title { get; }
    public int Minutes { get; }
    public bool Done { get; private set; }

    public TaskCard(string title, int minutes)
    {
    }

    public void Complete()
    {
    }

    public string Describe()
    {
        return "";
    }
}
