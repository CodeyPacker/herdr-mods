public static int Total(int open, int done)
{
    return open + done;
}

public static string Summary(int open, int done)
{
    return $"{open} open, {done} done, {Total(open, done)} total";
}
