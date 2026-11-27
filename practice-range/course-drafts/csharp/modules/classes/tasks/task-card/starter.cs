public class Book
{
    public string Title { get; }
    public int Pages { get; }
    public bool Finished { get; private set; }

    public Book(string title, int pages)
    {
    }

    public void MarkFinished()
    {
    }

    public string Describe()
    {
        return "";
    }
}
