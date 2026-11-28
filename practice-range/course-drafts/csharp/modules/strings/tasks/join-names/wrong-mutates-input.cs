public static string JoinNames(List<string> names)
{
    for (int i = names.Count - 1; i >= 0; i--)
    {
        if (String.IsNullOrWhiteSpace(names[i])) names.RemoveAt(i);
        else names[i] = names[i].Trim();
    }
    return String.Join(", ", names);
}
