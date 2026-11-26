public static int Checked(int minutes)
{
    if (minutes < 0)
    {
        throw new Exception("Minutes cannot be negative.");
    }
    return minutes;
}
