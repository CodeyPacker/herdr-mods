public static int UniqueOwners(List<string> owners)
{
    HashSet<string> seen = new HashSet<string>();
    foreach (string owner in owners)
    {
        if (owner != "")
        {
            seen.Add(owner);
        }
    }
    return seen.Count;
}
