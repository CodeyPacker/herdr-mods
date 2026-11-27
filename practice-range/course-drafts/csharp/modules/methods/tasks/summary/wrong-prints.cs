public static int Total(int apples, int pears)
{
    return apples + pears;
}

public static void Summary(int apples, int pears)
{
    Console.WriteLine($"apples: {apples}, pears: {pears}, total: {Total(apples, pears)}");
}
