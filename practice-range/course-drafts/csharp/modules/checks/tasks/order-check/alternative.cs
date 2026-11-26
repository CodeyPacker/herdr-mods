public static bool OrderCheck(Func<string, string, string> candidate)
{
    string joined = candidate("a", "b");
    if (joined != "a/b")
    {
        return false;
    }
    return candidate("b", "a") == "b/a";
}
