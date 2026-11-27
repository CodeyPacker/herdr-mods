public class Book
{
    public string Title { get; }
    public int Pages { get; }
    public bool Finished { get; private set; }

    public Book(string title, int pages)
    {
        Title = title;
        Pages = pages;
        Finished = false;
    }

    public void MarkFinished() => Finished = true;

    public string Describe()
    {
        string detail = Finished ? "finished" : Pages + " pages";
        return Title + " (" + detail + ")";
    }
}
