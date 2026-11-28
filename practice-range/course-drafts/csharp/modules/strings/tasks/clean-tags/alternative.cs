public static List<string> CleanTags(string input)
{
    List<string> result = new List<string>();
    string[] fields = input.Split(',');
    for (int i = 0; i < fields.Length; i++)
    {
        string tag = fields[i].Trim();
        if (tag != "") result.Add(tag);
    }
    return result;
}
