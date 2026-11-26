public static string Lane(Job job) => job switch
{
    { Urgent: true } => "now",
    { Minutes: 0 } => "skip",
    { Minutes: < 30 } => "quick",
    _ => "plan"
};
