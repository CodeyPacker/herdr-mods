public static int StockFor(Dictionary<string, int> stock, string item)
{
    stock.TryGetValue(item, out int found);
    if (found == 0)
    {
        return -1;
    }
    return found;
}
