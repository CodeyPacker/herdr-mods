public static string DisplayName(string? nickname)
{
    if (nickname.Length == 0)
    {
        return "Guest";
    }
    return nickname;
}
