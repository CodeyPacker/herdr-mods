public static List<string> UnwatchedTitles(List<Movie> movies)
{
    return movies.Select(movie => movie.Title).ToList();
}
