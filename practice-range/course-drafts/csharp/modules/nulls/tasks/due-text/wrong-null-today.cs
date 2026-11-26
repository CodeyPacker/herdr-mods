public static string DueText(int? days)
{
    int count = days ?? 0;
    if (count == 0)
    {
        return "due today";
    }
    if (count == 1)
    {
        return "due tomorrow";
    }
    return $"due in {count} days";
}
