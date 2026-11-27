public static Dictionary<string, int> MinutesByGenre(List<Movie> movies)
{
    return movies
        .Where(movie => !movie.Watched)
        .GroupBy(movie => movie.Genre)
        .ToDictionary(group => group.Key, group => group.Count());
}
