async Task<int> ReadCountAsync()
{
    await Task.Yield();
    return 3;
}

int count = ReadCountAsync();
Console.WriteLine(count);
