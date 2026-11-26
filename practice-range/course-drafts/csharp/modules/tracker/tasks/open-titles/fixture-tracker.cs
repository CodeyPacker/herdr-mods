// Supplied tracker types.
public record TaskItem(int Id, string Title, string Owner, bool Done);

public interface ITaskReader
{
    Task<List<TaskItem>> ReadAsync();
}

public class MemoryReader : ITaskReader
{
    public List<TaskItem> Tasks { get; }

    public MemoryReader(List<TaskItem> tasks)
    {
        Tasks = tasks;
    }

    public async Task<List<TaskItem>> ReadAsync()
    {
        await Task.Yield();
        return new List<TaskItem>(Tasks);
    }
}

public class OfflineReader : ITaskReader
{
    public async Task<List<TaskItem>> ReadAsync()
    {
        await Task.Yield();
        throw new InvalidOperationException("Reader is offline.");
    }
}
