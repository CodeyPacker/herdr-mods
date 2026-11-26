public static bool RenameCheck(Func<TaskItem, string, TaskItem> candidate)
{
    TaskItem renamed = candidate(new TaskItem(4, "Pack", true), "Ship");
    return renamed.Id == 4 && renamed.Done;
}
