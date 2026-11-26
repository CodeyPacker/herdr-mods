// Supplied data. Sample.Minutes() returns a new dictionary each time.
public static class Sample
{
    public static Dictionary<string, int> Minutes()
    {
        Dictionary<string, int> minutes = new Dictionary<string, int>();
        minutes["Pack"] = 30;
        minutes["Rest"] = 0;
        minutes["Ship"] = 45;
        return minutes;
    }
}
