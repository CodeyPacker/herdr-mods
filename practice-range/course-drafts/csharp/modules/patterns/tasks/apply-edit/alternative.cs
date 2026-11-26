public static int Next(int count, Edit edit)
{
    if (edit is Add a) return count + a.Amount;
    if (edit is Set s) return s.Value;
    return count;
}
