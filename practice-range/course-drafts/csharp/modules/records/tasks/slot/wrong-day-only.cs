public record Slot(string Day, int Hour);

public static class Slots
{
    public static bool Clash(Slot a, Slot b)
    {
        return a.Day == b.Day;
    }

    public static Slot NextHour(Slot slot)
    {
        return slot with { Hour = slot.Hour + 1 };
    }
}
