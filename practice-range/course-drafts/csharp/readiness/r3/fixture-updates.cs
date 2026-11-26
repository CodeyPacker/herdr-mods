// Supplied record types. Each one is a kind of Update.
public abstract record Update;
public record Arrived(int Count) : Update;
public record Finished(string Title, int Minutes) : Update;
public record Note(string Text) : Update;
