public static List<string> UnwatchedTitles(List<Movie> movies)
{
    List<string> titles = new List<string>();
    foreach (Movie movie in movies)
    {
        if (movie.Watched == false)
        {
            titles.Add(movie.Title);
        }
    }
    return titles;
}
