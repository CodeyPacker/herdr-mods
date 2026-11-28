public static bool HasCode(string[] codes, string wanted)
{
    for (int i = 0; i < codes.Length; i++)
    {
        bool equal = StringComparer.OrdinalIgnoreCase.Equals(codes[i], wanted);
        if (equal) return true;
    }
    return false;
}
