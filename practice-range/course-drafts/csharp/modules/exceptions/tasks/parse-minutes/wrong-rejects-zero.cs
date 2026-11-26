public static Parsed ParseMinutes(string text)
{
    if (!int.TryParse(text, out int minutes))
    {
        return new Parsed(false, 0, "not a number");
    }
    if (minutes <= 0)
    {
        return new Parsed(false, 0, "negative");
    }
    return new Parsed(true, minutes, "");
}
