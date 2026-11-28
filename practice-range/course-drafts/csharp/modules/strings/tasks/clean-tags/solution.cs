public static List<string> CleanTags(string input)
{
    List<string> result = new List<string>();
    foreach (string field in input.Split(','))
    {
        string tag = field.Trim();
        if (tag.Length > 0)
        {
            result.Add(tag);
        }
    }
    return result;
}
