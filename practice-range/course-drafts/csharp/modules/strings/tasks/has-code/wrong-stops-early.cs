public static bool HasCode(string[] codes, string wanted)
{
    if (codes.Length == 0) return false;
    return String.Equals(codes[0], wanted, StringComparison.OrdinalIgnoreCase);
}
