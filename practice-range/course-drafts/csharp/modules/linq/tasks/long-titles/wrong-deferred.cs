public static IEnumerable<string> LongTitles(List<Movie> movies, int limit)
{
    return movies.Where(movie => movie.Minutes > limit).Select(movie => movie.Title);
}
