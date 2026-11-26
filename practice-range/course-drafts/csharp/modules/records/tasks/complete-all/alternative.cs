public static List<TaskItem> CompleteAll(List<TaskItem> tasks)
{
    var result = new List<TaskItem>(tasks);
    for (int i = 0; i < result.Count; i++)
    {
        result[i] = new TaskItem(result[i].Id, result[i].Title, true);
    }
    return result;
}
