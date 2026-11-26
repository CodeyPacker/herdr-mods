public static bool RenameCheck(Func<TaskItem, string, TaskItem> candidate)
{
    TaskItem renamed = candidate(new TaskItem(7, "Label", true), "Send");
    if (renamed.Title != "Send")
    {
        return false;
    }
    return renamed.Id == 7 && renamed.Done;
}
