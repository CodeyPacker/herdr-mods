// Supplied record type and sample data. Sample.Movies() returns a new list each time.
public record Movie(string Title, string Genre, int Minutes, bool Watched);

public static class Sample
{
    public static List<Movie> Movies()
    {
        return new List<Movie>
        {
            new Movie("Up", "Drama", 30, true),
            new Movie("Jaws", "Comedy", 45, false),
            new Movie("Heat", "Drama", 10, false),
            new Movie("Alien", "Horror", 60, true),
            new Movie("Big", "Drama", 20, false),
        };
    }
}
