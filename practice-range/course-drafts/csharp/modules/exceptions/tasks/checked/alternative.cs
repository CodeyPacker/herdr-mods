public static int Checked(int minutes)
{
    if (minutes >= 0)
    {
        return minutes;
    }
    throw new ArgumentOutOfRangeException(nameof(minutes));
}
