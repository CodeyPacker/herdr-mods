public static Dictionary<string, int> MinutesByGenre(List<Movie> movies)
{
    var groups = movies.Where(movie => !movie.Watched).GroupBy(movie => movie.Genre);
    var result = new Dictionary<string, int>();
    foreach (var group in groups)
    {
        result.Add(group.Key, group.Sum(movie => movie.Minutes));
    }
    return result;
}
