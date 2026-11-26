public static string Display(Reading reading)
{
    if (!reading.Online) return "offline";
    if (reading.Degrees < 0) return "freezing";
    return reading.Degrees + " degrees";
}
