public static List<string> UnwatchedTitles(List<Movie> movies)
{
    return movies.Where(movie => movie.Watched).Select(movie => movie.Title).ToList();
}
