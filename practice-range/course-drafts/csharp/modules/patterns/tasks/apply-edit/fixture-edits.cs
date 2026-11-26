// Supplied record types. Each one is a kind of Edit.
public abstract record Edit;
public record Add(int Amount) : Edit;
public record Set(int Value) : Edit;
public record Keep : Edit;
