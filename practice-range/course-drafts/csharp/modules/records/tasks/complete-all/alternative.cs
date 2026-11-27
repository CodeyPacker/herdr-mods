public static List<Song> LikeAll(List<Song> songs)
{
    var result = new List<Song>(songs);
    for (int i = 0; i < result.Count; i++)
    {
        result[i] = new Song(result[i].Id, result[i].Title, true);
    }
    return result;
}
