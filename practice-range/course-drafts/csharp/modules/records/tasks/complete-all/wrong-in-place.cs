public static List<Song> LikeAll(List<Song> songs)
{
    for (int i = 0; i < songs.Count; i++)
    {
        songs[i] = songs[i] with { Liked = true };
    }
    return songs;
}
