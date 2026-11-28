// Local stand-in for a disposable file or database reader. No external resource is opened.
public sealed class LocalReader : IDisposable
{
    private string key;
    public static int Opened { get; private set; }
    public static int Closed { get; private set; }
    private LocalReader(string key) { this.key = key; }
    public static void Reset() { Opened = 0; Closed = 0; }
    public static LocalReader Open(string key) { Opened++; return new LocalReader(key); }
    public string Read()
    {
        if (key == "broken") throw new FormatException("Unreadable text.");
        return key == "blank" ? "" : "value of " + key;
    }
    public void Dispose() { Closed++; }
}
