public record Slot(string Day, int Hour);

public static class Slots
{
    public static bool Clash(Slot a, Slot b)
    {
        return a.Day == b.Day && a.Hour == b.Hour;
    }

    public static Slot NextHour(Slot slot)
    {
        return new Slot(slot.Day, slot.Hour + 1);
    }
}
