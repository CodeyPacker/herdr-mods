public static bool HasCode(string[] codes, string wanted)
{
    foreach (string code in codes)
    {
        if (code.IndexOf(wanted, StringComparison.OrdinalIgnoreCase) >= 0) return true;
    }
    return false;
}
