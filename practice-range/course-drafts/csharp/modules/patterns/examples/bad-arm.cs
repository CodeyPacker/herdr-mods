string Size(int minutes) => minutes switch
{
    _ => "long",
    < 30 => "short"
};

Console.WriteLine(Size(10));
