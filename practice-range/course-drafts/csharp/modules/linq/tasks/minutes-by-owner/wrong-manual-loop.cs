public static Dictionary<string, int> MinutesByGenre(List<Movie> movies)
{
    Dictionary<string, int> totals = new Dictionary<string, int>();
    foreach (Movie movie in movies)
    {
        if (movie.Watched)
        {
            continue;
        }
        totals.TryGetValue(movie.Genre, out int current);
        totals[movie.Genre] = current + movie.Minutes;
    }
    return totals;
}
