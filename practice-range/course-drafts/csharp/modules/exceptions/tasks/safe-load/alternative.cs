public static string SafeLoad(string key)
{
    string loaded;
    try
    {
        loaded = Store.Load(key);
    }
    catch (InvalidOperationException error)
    {
        loaded = error.Message == "" ? "" : "unavailable";
    }
    return loaded;
}
