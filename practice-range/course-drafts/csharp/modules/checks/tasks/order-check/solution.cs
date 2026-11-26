public static bool OrderCheck(Func<string, string, string> candidate)
{
    return candidate("west", "east") == "west/east";
}
