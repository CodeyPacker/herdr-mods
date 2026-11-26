public static string OwnerLabel(string? owner)
{
    if (owner == null || owner == "")
    {
        return "Unassigned";
    }
    return owner;
}
