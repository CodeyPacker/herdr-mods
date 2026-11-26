public static List<string> Summaries(List<Update> updates)
{
    return updates
        .Where(update => update is Arrived || update is Finished)
        .Select(update =>
        {
            if (update is Arrived arrived)
            {
                return arrived.Count + " arrived";
            }
            Finished finished = (Finished)update;
            if (finished.Minutes < 0)
            {
                throw new ArgumentException("Minutes cannot be negative.");
            }
            return finished.Title + ": " + finished.Minutes + " min";
        })
        .ToList();
}
