public static string DisplayName(string? nickname)
{
    if (nickname == null || nickname == "")
    {
        return "Guest";
    }
    return nickname;
}
