public static List<string> CleanTags(string input)
{
    List<string> result = new List<string>();
    foreach (string field in input.Split(',')) result.Add(field.Trim());
    return result;
}
