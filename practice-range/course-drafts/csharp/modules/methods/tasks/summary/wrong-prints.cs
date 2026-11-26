public static int Total(int open, int done)
{
    return open + done;
}

public static void Summary(int open, int done)
{
    Console.WriteLine($"{open} open, {done} done, {Total(open, done)} total");
}
