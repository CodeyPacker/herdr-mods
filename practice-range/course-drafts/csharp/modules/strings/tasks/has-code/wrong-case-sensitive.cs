public static bool HasCode(string[] codes, string wanted)
{
    foreach (string code in codes) if (code == wanted) return true;
    return false;
}
