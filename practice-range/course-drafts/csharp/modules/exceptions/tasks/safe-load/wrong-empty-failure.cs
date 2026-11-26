public static string SafeLoad(string key)
{
    try
    {
        string loaded = Store.Load(key);
        if (loaded == "")
        {
            return "unavailable";
        }
        return loaded;
    }
    catch (InvalidOperationException)
    {
        return "unavailable";
    }
}
