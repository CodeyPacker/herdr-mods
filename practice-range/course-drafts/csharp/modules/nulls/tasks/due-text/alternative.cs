public static string DueText(int? days)
{
    if (!days.HasValue)
    {
        return "no due date";
    }
    int count = days.Value;
    if (count > 1)
    {
        return "due in " + count + " days";
    }
    return count == 0 ? "due today" : "due tomorrow";
}
