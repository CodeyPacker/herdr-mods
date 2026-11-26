public static int UniqueOwners(List<string> owners)
{
    int count = 0;
    foreach (string owner in owners)
    {
        if (owner != "")
        {
            count = count + 1;
        }
    }
    return count;
}
