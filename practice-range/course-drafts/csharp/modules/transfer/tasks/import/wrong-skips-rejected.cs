public static ImportReport Import(List<string> lines)
{
    Dictionary<string, int> totals = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
    foreach (string line in lines)
    {
        string[] fields = line.Split(',');
        if (fields.Length != 2 || fields[0].Trim() == "" || !int.TryParse(fields[1].Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out int count) || count < 0) continue;
        string name = fields[0].Trim();
        if (totals.ContainsKey(name)) totals[name] += count; else totals.Add(name, count);
    }
    return new ImportReport(totals, 0);
}
