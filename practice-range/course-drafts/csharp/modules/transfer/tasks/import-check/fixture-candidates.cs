public record ImportReport(Dictionary<string, int> Totals, int Rejected);

public static class ImportCandidates
{
    public static ImportReport CorrectLoop(List<string> lines)
    {
        var totals = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        int rejected = 0;
        foreach (string line in lines)
        {
            string[] fields = line.Split(',');
            if (fields.Length != 2)
            {
                rejected++;
                continue;
            }
            string name = fields[0].Trim();
            if (name.Length == 0 || !int.TryParse(fields[1].Trim(), System.Globalization.NumberStyles.Integer,
                System.Globalization.CultureInfo.InvariantCulture, out int count) || count < 0)
            {
                rejected++;
                continue;
            }
            if (totals.TryGetValue(name, out int previous)) totals[name] = previous + count;
            else totals.Add(name, count);
        }
        return new ImportReport(totals, rejected);
    }

    public static ImportReport CorrectContainsKey(List<string> lines)
    {
        var totals = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        int rejected = 0;
        foreach (string line in lines)
        {
            string[] fields = line.Split(',');
            string name = fields.Length == 2 ? fields[0].Trim() : "";
            if (fields.Length != 2 || name.Length == 0 ||
                !int.TryParse(fields[1].Trim(), System.Globalization.NumberStyles.Integer,
                    System.Globalization.CultureInfo.InvariantCulture, out int count) || count < 0)
            {
                rejected++;
                continue;
            }
            if (!totals.ContainsKey(name)) totals.Add(name, 0);
            totals[name] += count;
        }
        return new ImportReport(totals, rejected);
    }

    public static ImportReport CaseSensitive(List<string> lines)
    {
        var totals = new Dictionary<string, int>();
        int rejected = 0;
        foreach (string line in lines)
        {
            string[] fields = line.Split(',');
            if (fields.Length != 2 || fields[0].Trim().Length == 0 ||
                !int.TryParse(fields[1].Trim(), System.Globalization.NumberStyles.Integer,
                    System.Globalization.CultureInfo.InvariantCulture, out int count) || count < 0)
            {
                rejected++;
                continue;
            }
            string name = fields[0].Trim();
            if (totals.TryGetValue(name, out int previous)) totals[name] = previous + count;
            else totals.Add(name, count);
        }
        return new ImportReport(totals, rejected);
    }

    public static ImportReport IgnoreRejected(List<string> lines)
    {
        return new ImportReport(CorrectLoop(lines).Totals, 0);
    }

    public static ImportReport DropZero(List<string> lines)
    {
        ImportReport report = CorrectLoop(lines);
        var totals = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        foreach (var pair in report.Totals)
            if (pair.Value != 0) totals.Add(pair.Key, pair.Value);
        return new ImportReport(totals, report.Rejected);
    }
}
