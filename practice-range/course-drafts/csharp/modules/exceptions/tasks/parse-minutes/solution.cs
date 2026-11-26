public static Parsed ParseMinutes(string text)
{
    int minutes;
    try
    {
        minutes = int.Parse(text);
    }
    catch (FormatException)
    {
        return new Parsed(false, 0, "not a number");
    }
    if (minutes < 0)
    {
        return new Parsed(false, 0, "negative");
    }
    return new Parsed(true, minutes, "");
}
