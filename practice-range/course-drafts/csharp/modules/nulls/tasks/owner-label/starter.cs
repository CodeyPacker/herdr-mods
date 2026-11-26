public static string OwnerLabel(string? owner)
{
    if (owner.Length == 0)
    {
        return "Unassigned";
    }
    return owner;
}
