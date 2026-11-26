// Supplied store. Load can return empty text, and it throws two kinds of exception.
public static class Store
{
    public static string Load(string key)
    {
        if (key == "")
        {
            throw new ArgumentException("Key is empty.");
        }
        if (key == "lost")
        {
            throw new InvalidOperationException("Store is offline.");
        }
        if (key == "blank")
        {
            return "";
        }
        return "value of " + key;
    }
}
