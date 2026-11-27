public static Song Rename(Song song, string title)
{
    return song with { Title = title };
}
