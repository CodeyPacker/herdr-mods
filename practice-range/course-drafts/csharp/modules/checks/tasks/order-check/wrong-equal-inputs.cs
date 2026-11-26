public static bool OrderCheck(Func<string, string, string> candidate)
{
    return candidate("a", "a") == "a/a";
}
