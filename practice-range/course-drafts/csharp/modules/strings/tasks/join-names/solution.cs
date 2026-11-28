public static string JoinNames(List<string> names)
{
    List<string> cleaned = new List<string>();
    foreach (string name in names)
    {
        string value = name.Trim();
        if (value.Length > 0) cleaned.Add(value);
    }
    return String.Join(", ", cleaned);
}
