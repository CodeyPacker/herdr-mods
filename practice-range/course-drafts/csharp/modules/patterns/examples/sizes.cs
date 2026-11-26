string Size(Job job) => job switch
{
    { Minutes: 0 } => "empty",
    { Minutes: < 30 } => "short",
    { Urgent: true } => "long and urgent",
    _ => "long"
};

Console.WriteLine(Size(new Job(0, true)));
Console.WriteLine(Size(new Job(10, true)));
Console.WriteLine(Size(new Job(45, true)));
Console.WriteLine(Size(new Job(45, false)));

record Job(int Minutes, bool Urgent);
