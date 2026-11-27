public static string Lane(Order order) => order switch
{
    { Urgent: true } => "now",
    { Minutes: 0 } => "skip",
    { Minutes: < 30 } => "quick",
    _ => "plan"
};
