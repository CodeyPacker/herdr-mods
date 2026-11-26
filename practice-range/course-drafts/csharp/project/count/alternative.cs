public static int RemainingAfter(int opening, int arrivals, int completed)
{
    int total = opening;
    total = total + arrivals;
    total = total - completed;
    return total;
}
