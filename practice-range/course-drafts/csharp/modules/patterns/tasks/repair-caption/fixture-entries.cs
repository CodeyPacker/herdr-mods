// Supplied record types. Each one is a kind of Entry, and every Entry has a Title.
public abstract record Entry(string Title);
public record Ready(string Title, int Minutes) : Entry(Title);
public record Blocked(string Title, string Reason) : Entry(Title);
public record Note(string Title) : Entry(Title);
