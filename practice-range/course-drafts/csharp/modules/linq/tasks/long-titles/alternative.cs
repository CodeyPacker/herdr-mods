public static IEnumerable<string> LongTitles(List<Movie> movies, int limit)
{
    List<string> titles = new List<string>();
    foreach (Movie movie in movies)
    {
        if (movie.Minutes > limit)
        {
            titles.Add(movie.Title);
        }
    }
    return titles;
}
