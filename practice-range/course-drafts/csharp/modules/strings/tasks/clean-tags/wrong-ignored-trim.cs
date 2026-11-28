public static List<string> CleanTags(string input)
{
    List<string> result = new List<string>();
    foreach (string field in input.Split(','))
    {
        field.Trim();
        if (field.Length > 0) result.Add(field);
    }
    return result;
}
