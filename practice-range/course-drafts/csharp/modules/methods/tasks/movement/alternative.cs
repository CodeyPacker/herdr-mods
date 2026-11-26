public static int Movement(int before, int after)
{
    int change = 0;
    if (after > before)
    {
        change = after - before;
    }
    else
    {
        change = -(before - after);
    }
    return change;
}
