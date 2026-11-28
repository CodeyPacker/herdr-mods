public static string ReadText(string key)
{
    using var reader = LocalReader.Open(key);
    return reader.Read();
}
