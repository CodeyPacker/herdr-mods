public static int StockFor(Dictionary<string, int> stock, string item)
{
    if (!stock.ContainsKey(item))
    {
        return -1;
    }
    return stock[item];
}
