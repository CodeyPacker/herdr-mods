public static Song Rename(Song song, string title) => new Song(song.Id, title, song.Liked);
