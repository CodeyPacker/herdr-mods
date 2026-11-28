public static Parsed ParseMinutes(string text)
{
    if (int.TryParse(text, out int minutes))
    {
        if (minutes >= 0) return new Parsed(true, minutes, "");
        return new Parsed(false, 0, "negative");
    }
    return new Parsed(false, 0, "not a number");
}
