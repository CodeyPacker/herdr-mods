public static ImportReport Import(List<string> lines)
{
    var totals = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
    foreach (string line in lines)
    {
        string[] fields = line.Split(',');
        if (fields.Length != 2 || fields[0].Trim().Length == 0 ||
            !int.TryParse(fields[1].Trim(), System.Globalization.NumberStyles.Integer,
                System.Globalization.CultureInfo.InvariantCulture, out int count) || count < 0)
            continue;
        string name = fields[0].Trim();
        if (totals.TryGetValue(name, out int previous)) totals[name] = previous + count;
        else totals.Add(name, count);
    }
    return new ImportReport(totals, 0);
}
