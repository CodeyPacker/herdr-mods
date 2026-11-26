public static double ExtraHours(double hours, double included)
{
    if (hours <= included)
    {
        return 0;
    }
    return hours - included;
}
