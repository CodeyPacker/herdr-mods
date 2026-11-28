public class Book
{
    public string Title { get; set; }
    public int Pages { get; set; }
    public bool Finished { get; set; }

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
        if (Finished)
        {
            return $"{Title} (finished)";
        }
        return $"{Title} ({Pages} pages)";
    }
}
