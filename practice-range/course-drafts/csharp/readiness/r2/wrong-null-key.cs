public static Book Renamed(Book book, string title)
{
    return book with { Title = title };
}

public static Dictionary<string, int> CountByAuthor(List<Book> books)
{
    Dictionary<string, int> counts = new Dictionary<string, int>();
    foreach (Book book in books)
    {
        counts.TryGetValue(book.Author, out int current);
        counts[book.Author] = current + 1;
    }
    return counts;
}
