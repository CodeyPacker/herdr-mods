public static Song Rename(Song song, string title)
{
    return new Song(song.Id, title, false);
}
