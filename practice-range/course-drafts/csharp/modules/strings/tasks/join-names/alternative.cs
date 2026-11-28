public static string JoinNames(List<string> names)
{
    List<string> cleaned = new List<string>();
    for (int i = 0; i < names.Count; i++)
    {
        string name = names[i];
        if (name.Trim().Length > 0) cleaned.Add(name.Trim());
    }
    return String.Join(", ", cleaned);
}
