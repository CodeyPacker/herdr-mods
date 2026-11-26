// Supplied types for the import audit.
public record Row(string Id, string Title);
public record AuditReport(string Status, int Accepted, int Duplicates, int Invalid);

public interface IRowReader
{
    Task<List<Row>> ReadAsync();
}

public class MemoryRows : IRowReader
{
    public List<Row> Rows { get; }
    public int Reads { get; private set; }

    public MemoryRows(List<Row> rows)
    {
        Rows = rows;
    }

    public async Task<List<Row>> ReadAsync()
    {
        Reads = Reads + 1;
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
