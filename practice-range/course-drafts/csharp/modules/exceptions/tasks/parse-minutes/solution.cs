public static Parsed ParseMinutes(string text)
{
    if (!int.TryParse(text, out int minutes))
    {
        return new Parsed(false, 0, "not a number");
    }
    return minutes < 0 ? new Parsed(false, 0, "negative") : new Parsed(true, minutes, "");
}
