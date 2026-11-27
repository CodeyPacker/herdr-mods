public class Book
{
    public string Title { get; }
    public int Pages { get; }
    public bool Finished { get; private set; }

    public Book(string title, int pages)
    {
        Title = title;
        Pages = pages;
    }

    public void MarkFinished()
    {
        Finished = true;
    }

    public string Describe()
    {
        return $"{Title} ({Pages} pages)";
    }
}
