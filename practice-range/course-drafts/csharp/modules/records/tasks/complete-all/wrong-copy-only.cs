public static List<Song> LikeAll(List<Song> songs)
{
    List<Song> result = new List<Song>();
    foreach (Song song in songs)
    {
        result.Add(song);
    }
    return result;
}
