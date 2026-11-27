public static Dictionary<string, int> MinutesByGenre(List<Movie> movies)
{
    return movies
        .GroupBy(movie => movie.Genre)
        .ToDictionary(group => group.Key, group => group.Sum(movie => movie.Minutes));
}
