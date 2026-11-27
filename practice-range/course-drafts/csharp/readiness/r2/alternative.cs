public static Book Renamed(Book book, string title)
{
    return new Book(book.Id, title, book.Author);
}

public static Dictionary<string, int> CountByAuthor(List<Book> books)
{
    var counts = new Dictionary<string, int>();
    foreach (Book book in books)
    {
        string key = "Unknown";
        if (book.Author != null)
        {
            key = book.Author;
        }
        counts.TryGetValue(key, out int current);
        counts[key] = current + 1;
    }
    return counts;
}
