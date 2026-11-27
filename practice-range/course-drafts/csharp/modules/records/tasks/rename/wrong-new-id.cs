public static Song Rename(Song song, string title)
{
    return new Song(0, title, song.Liked);
}
