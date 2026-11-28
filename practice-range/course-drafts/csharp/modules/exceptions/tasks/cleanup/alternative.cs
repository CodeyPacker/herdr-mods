public static string ReadText(string key)
{
    var reader = LocalReader.Open(key);
    try { return reader.Read(); }
    finally { reader.Dispose(); }
}
