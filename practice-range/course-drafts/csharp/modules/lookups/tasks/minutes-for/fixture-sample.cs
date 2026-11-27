// Supplied data. Sample.Stock() returns a new dictionary each time.
public static class Sample
{
    public static Dictionary<string, int> Stock()
    {
        Dictionary<string, int> stock = new Dictionary<string, int>();
        stock["apples"] = 30;
        stock["pears"] = 0;
        stock["plums"] = 45;
        return stock;
    }
}
