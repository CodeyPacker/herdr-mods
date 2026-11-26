// Supplied record types. Each one is a kind of Update.
public abstract record Update;
public record Arrived(int Count) : Update;
public record Finished(string Title, int Minutes) : Update;
public record Paused(string Reason) : Update;
public record Archived : Update;
