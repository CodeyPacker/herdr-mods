// Supplied contract and two readers.
public interface IReader<T>
{
    Task<T> ReadAsync();
}

public class MemoryReader<T> : IReader<T>
{
    public T Value { get; }

    public MemoryReader(T value)
    {
        Value = value;
    }

    public async Task<T> ReadAsync()
    {
        await Task.Yield();
        return Value;
    }
}

public class OfflineReader<T> : IReader<T>
{
    public async Task<T> ReadAsync()
    {
        await Task.Yield();
        throw new InvalidOperationException("Reader is offline.");
    }
}
