public static string Lane(Order order) => order switch
{
    { Minutes: 0 } => "skip",
    { Urgent: true } => "now",
    { Minutes: < 30 } => "quick",
    _ => "plan"
};
