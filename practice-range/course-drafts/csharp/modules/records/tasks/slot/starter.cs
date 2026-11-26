public class Slot
{
    public string Day { get; set; }
    public int Hour { get; set; }

    public Slot(string day, int hour)
    {
        Day = day;
        Hour = hour;
    }
}

public static class Slots
{
    public static bool Clash(Slot a, Slot b)
    {
        return false;
    }

    public static Slot NextHour(Slot slot)
    {
        return slot;
    }
}
