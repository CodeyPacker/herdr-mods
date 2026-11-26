public static string Display(Reading reading) => reading switch
{
    { Degrees: < 0 } => "freezing",
    { Online: false } => "offline",
    _ => $"{reading.Degrees} degrees"
};
