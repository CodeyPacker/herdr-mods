public static int Movement(int before, int after)
{
    if (after > before)
    {
        return after - before;
    }
    return before - after;
}
