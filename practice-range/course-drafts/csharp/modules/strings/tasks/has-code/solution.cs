public static bool HasCode(string[] codes, string wanted)
{
    foreach (string code in codes)
    {
        if (String.Equals(code, wanted, StringComparison.OrdinalIgnoreCase)) return true;
    }
    return false;
}
