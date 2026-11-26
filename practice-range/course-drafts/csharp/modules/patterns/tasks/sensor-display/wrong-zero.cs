public static string Display(Reading reading) => reading switch
{
    { Online: false } => "offline",
    { Degrees: <= 0 } => "freezing",
    _ => $"{reading.Degrees} degrees"
};
