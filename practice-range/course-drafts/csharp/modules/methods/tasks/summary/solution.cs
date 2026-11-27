public static int Total(int apples, int pears)
{
    return apples + pears;
}

public static string Summary(int apples, int pears)
{
    return $"apples: {apples}, pears: {pears}, total: {Total(apples, pears)}";
}
