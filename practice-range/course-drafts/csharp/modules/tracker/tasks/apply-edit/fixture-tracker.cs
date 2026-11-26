// Supplied tracker types.
public record TaskItem(int Id, string Title, string Owner, bool Done);

public abstract record Edit(int Id);
public record Rename(int Id, string Title) : Edit(Id);
public record Complete(int Id) : Edit(Id);
public record Assign(int Id, string Owner) : Edit(Id);
