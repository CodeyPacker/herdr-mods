List<string> ids = new List<string> { "A", "B", "A" };
HashSet<string> seen = new HashSet<string>();
int duplicates = 0;
foreach (string id in ids)
{
    if (!seen.Add(id))
    {
        duplicates = duplicates + 1;
    }
}
Console.WriteLine(seen.Count);
Console.WriteLine(duplicates);
