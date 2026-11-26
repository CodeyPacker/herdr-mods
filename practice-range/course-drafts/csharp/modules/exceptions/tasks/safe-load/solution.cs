public static string SafeLoad(string key)
{
    try
    {
        return Store.Load(key);
    }
    catch (InvalidOperationException)
    {
        return "unavailable";
    }
}
