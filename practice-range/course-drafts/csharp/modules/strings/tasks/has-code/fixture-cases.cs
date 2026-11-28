public static class Given
{
    public static bool ArrayPreserved(Func<string[], string, bool> candidate)
    {
        string[] codes = new string[] { "FILE", "XY-2" };
        candidate(codes, "file");
        return codes.Length == 2 && codes[0] == "FILE" && codes[1] == "XY-2";
    }

    public static bool CultureIndependent(Func<string[], string, bool> candidate)
    {
        CultureInfo previous = CultureInfo.CurrentCulture;
        try
        {
            CultureInfo.CurrentCulture = new CultureInfo("tr-TR");
            return candidate(new string[] { "FILE" }, "file");
        }
        finally
        {
            CultureInfo.CurrentCulture = previous;
        }
    }
}
