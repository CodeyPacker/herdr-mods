public static int Next(int count, Edit edit) => edit switch
{
    Add a => count + a.Amount,
    Set s => s.Value,
    _ => count
};
