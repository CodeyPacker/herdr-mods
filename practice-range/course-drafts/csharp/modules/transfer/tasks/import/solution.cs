public static ImportReport Import(List<string> lines)
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
        if (name.Length == 0 ||
            !int.TryParse(fields[1].Trim(), System.Globalization.NumberStyles.Integer,
                System.Globalization.CultureInfo.InvariantCulture, out int count) ||
            count < 0)
        {
            rejected++;
            continue;
        }

        if (totals.TryGetValue(name, out int previous))
            totals[name] = previous + count;
        else
            totals.Add(name, count);
    }

    return new ImportReport(totals, rejected);
}
