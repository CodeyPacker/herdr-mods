public static string Lane(Job job) => job switch
{
    { Minutes: 0 } => "skip",
    { Urgent: true } => "now",
    { Minutes: <= 30 } => "quick",
    _ => "plan"
};
