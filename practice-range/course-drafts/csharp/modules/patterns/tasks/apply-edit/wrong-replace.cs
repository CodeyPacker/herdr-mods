public static int Next(int count, Edit edit) => edit switch
{
    Add a => a.Amount,
    Set s => s.Value,
    _ => count
};
