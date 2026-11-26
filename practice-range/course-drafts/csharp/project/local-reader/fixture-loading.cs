// Supplied types for loading tasks.
public record Row(string Id, string Title);
public record TaskItem(int Id, string Title, bool Done);
public record LoadResult(bool Ok, List<TaskItem> Tasks, string Error);

public interface IRowReader
{
    Task<List<Row>> ReadAsync();
}

public class MemoryRows : IRowReader
{
    public List<Row> Rows { get; }

    public MemoryRows(List<Row> rows)
    {
        Rows = rows;
    }

    public async Task<List<Row>> ReadAsync()
    {
        await Task.Yield();
        return new List<Row>(Rows);
    }
}

public class OfflineRows : IRowReader
{
    public async Task<List<Row>> ReadAsync()
    {
        await Task.Yield();
        throw new InvalidOperationException("Rows are unavailable.");
    }
}
