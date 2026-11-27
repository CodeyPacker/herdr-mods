public static int StockFor(Dictionary<string, int> stock, string item)
{
    if (stock.TryGetValue(item, out int found))
    {
        return found;
    }
    return -1;
}
