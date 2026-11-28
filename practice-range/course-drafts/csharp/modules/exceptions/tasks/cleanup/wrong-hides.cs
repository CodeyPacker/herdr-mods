public static string ReadText(string key)
{
    using var reader = LocalReader.Open(key);
    try { return reader.Read(); }
    catch (FormatException) { return ""; }
}
