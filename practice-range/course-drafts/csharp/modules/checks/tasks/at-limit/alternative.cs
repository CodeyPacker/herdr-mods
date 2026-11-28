public static bool InWindow(int value, int start, int end)
{
    if (value < start) return false;
    return value < end;
}
