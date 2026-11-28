public static ImportReport Import(List<string> lines)
{
    var totals = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
    int rejected = 0;

    foreach (string line in lines)
    {
        string[] fields = line.Split(',');
        string name = fields.Length == 2 ? fields[0].Trim() : "";
        bool valid = fields.Length == 2 && name.Length > 0 &&
            int.TryParse(fields[1].Trim(), System.Globalization.NumberStyles.Integer,
                System.Globalization.CultureInfo.InvariantCulture, out int count) && count >= 0;
        if (!valid)
        {
            rejected++;
            continue;
        }

        int parsed = int.Parse(fields[1].Trim(), System.Globalization.NumberStyles.Integer,
            System.Globalization.CultureInfo.InvariantCulture);
        if (!totals.ContainsKey(name)) totals.Add(name, 0);
        totals[name] += parsed;
    }

    return new ImportReport(totals, rejected);
}
