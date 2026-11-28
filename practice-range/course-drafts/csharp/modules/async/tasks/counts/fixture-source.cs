// Supplied local source. It uses no network and no clock.
public static class Source
{
    public static List<string> Calls { get; } = new List<string>();

    public static async Task<int> CountAsync(string shop)
    {
        Calls.Add(shop);
        await Task.Yield();
        if (shop == "offline")
        {
            throw new InvalidOperationException("Shop is offline.");
        }
        if (shop == "north")
        {
            return 3;
        }
        if (shop == "south")
        {
            return 5;
        }
        return 0;
    }
}
