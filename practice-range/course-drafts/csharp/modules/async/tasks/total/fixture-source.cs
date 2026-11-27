// Supplied local source. It uses no network and no clock.
public static class Source
{
    public static async Task<int> CountAsync(string shop)
    {
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
