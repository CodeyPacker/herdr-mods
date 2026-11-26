public static string DueText(int? days)
{
    if (days == null)
    {
        return "no due date";
    }
    if (days == 0)
    {
        return "due today";
    }
    if (days == 1)
    {
        return "due tomorrow";
    }
    return $"due in {days} days";
}
