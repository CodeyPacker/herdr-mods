public record ImportReport(Dictionary<string, int> Totals, int Rejected);

public static class FixtureInput
{
    public static bool IsUnchanged()
    {
        var lines = new List<string> { " Ada , +2 ", "ada,3", "Bob,0" };
        var before = new List<string>(lines);
        Practice.Import(lines);
        return lines.SequenceEqual(before);
    }
}
