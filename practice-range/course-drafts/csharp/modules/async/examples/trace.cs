async Task<int> ReadCountAsync()
{
    Console.WriteLine("reading");
    await Task.Yield();
    return 3;
}

async Task<int> ReadBrokenAsync()
{
    await Task.Yield();
    throw new InvalidOperationException("Source is offline.");
}

Console.WriteLine("start");
int count = await ReadCountAsync();
Console.WriteLine(count);

try
{
    await ReadBrokenAsync();
}
catch (InvalidOperationException error)
{
    Console.WriteLine(error.Message);
}
