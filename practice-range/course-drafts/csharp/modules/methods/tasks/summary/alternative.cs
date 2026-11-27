public static int Total(int apples, int pears) => apples + pears;

public static string Summary(int apples, int pears)
{
    int total = Total(apples, pears);
    return "apples: " + apples + ", pears: " + pears + ", total: " + total;
}
