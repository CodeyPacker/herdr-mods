public static string Lane(Job job)
{
    if (job.Minutes == 0) return "skip";
    if (job.Urgent) return "now";
    if (job.Minutes < 30) return "quick";
    return "plan";
}
