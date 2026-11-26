public static bool RenameCheck(Func<TaskItem, string, TaskItem> candidate)
{
    return candidate(new TaskItem(4, "Pack", true), "Ship") == new TaskItem(4, "Ship", true);
}
