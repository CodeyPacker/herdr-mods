int ReadMinutes(string text)
{
    try
    {
        return int.Parse(text);
    }
    catch (FormatException)
    {
        return -1;
    }
}

void Check(int minutes)
{
    if (minutes < 0)
    {
        throw new ArgumentException("Minutes cannot be negative.");
    }
}

Console.WriteLine(ReadMinutes("30"));
Console.WriteLine(ReadMinutes("soon"));

try
{
    Check(-5);
    Console.WriteLine("checked");
}
catch (ArgumentException error)
{
    Console.WriteLine(error.Message);
}
