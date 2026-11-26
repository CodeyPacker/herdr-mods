public static bool RenameCheck(Func<TaskItem, string, TaskItem> candidate)
{
    return candidate(new TaskItem(4, "Pack", false), "Ship") == new TaskItem(4, "Ship", false);
}
