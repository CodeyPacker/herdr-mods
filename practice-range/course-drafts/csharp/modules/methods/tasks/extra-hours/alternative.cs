public static double ExtraHours(double hours, double included)
{
    double beyond = hours - included;
    if (beyond < 0)
    {
        beyond = 0;
    }
    return beyond;
}
