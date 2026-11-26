public static int UniqueOwners(List<string> owners)
{
    List<string> seen = new List<string>();
    foreach (string owner in owners)
    {
        if (owner == "" || seen.Contains(owner))
        {
            continue;
        }
        seen.Add(owner);
    }
    return seen.Count;
}
