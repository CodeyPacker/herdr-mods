public static double ExtraHours(double hours, double included)
{
    if (hours > included)
    {
        return hours;
    }
    return 0;
}
