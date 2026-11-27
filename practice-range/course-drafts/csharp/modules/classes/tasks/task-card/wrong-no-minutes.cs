public class Book
{
    public string Title { get; }
    public int Pages { get; }
    public bool Finished { get; private set; }

    public Book(string title, int pages)
    {
        Title = title;
    }

    public void MarkFinished()
    {
        Finished = true;
    }

    public string Describe()
    {
        if (Finished)
        {
            return $"{Title} (finished)";
        }
        return $"{Title} ({Pages} pages)";
    }
}
