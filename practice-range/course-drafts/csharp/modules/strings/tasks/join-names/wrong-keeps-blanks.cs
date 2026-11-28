public static string JoinNames(List<string> names)
{
    List<string> cleaned = new List<string>();
    foreach (string name in names) cleaned.Add(name == null ? "" : name.Trim());
    return String.Join(", ", cleaned);
}
