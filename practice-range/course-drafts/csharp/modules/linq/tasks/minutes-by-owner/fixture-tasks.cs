// Supplied record type and sample data. Sample.Tasks() returns a new list each time.
public record TaskItem(string Title, string Owner, int Minutes, bool Done);

public static class Sample
{
    public static List<TaskItem> Tasks()
    {
        return new List<TaskItem>
        {
            new TaskItem("Pack", "Ana", 30, true),
            new TaskItem("Ship", "Ben", 45, false),
            new TaskItem("Label", "Ana", 10, false),
            new TaskItem("Audit", "Cy", 60, true),
            new TaskItem("Count", "Ana", 20, false),
        };
    }
}
