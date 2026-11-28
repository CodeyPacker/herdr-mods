public static string ReadText(string key)
{
    var reader = LocalReader.Open(key);
    string text = reader.Read();
    reader.Dispose();
    return text;
}
