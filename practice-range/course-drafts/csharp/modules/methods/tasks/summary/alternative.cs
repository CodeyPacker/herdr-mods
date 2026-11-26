public static int Total(int open, int done) => open + done;

public static string Summary(int open, int done)
{
    int total = Total(open, done);
    return open + " open, " + done + " done, " + total + " total";
}
