public static Book Renamed(Book book, string title)
{
    return book with { Title = title };
}

public static Dictionary<string, int> CountByAuthor(List<Book> books)
{
    Dictionary<string, int> counts = new Dictionary<string, int>();
    foreach (Book book in books)
    {
        string key = book.Author ?? "Unknown";
        if (counts.ContainsKey(key))
        {
            counts[key] = counts[key] + 1;
        }
        else
        {
            counts[key] = 1;
        }
    }
    return counts;
}
