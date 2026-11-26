public static Parsed ParseMinutes(string text)
{
    try
    {
        return new Parsed(true, int.Parse(text), "");
    }
    catch (FormatException)
    {
        return new Parsed(false, 0, "not a number");
    }
}
