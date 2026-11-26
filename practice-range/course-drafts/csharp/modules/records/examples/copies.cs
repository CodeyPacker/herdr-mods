Job first = new Job("Pack", 30);
Job second = first with { Minutes = 45 };
Console.WriteLine(first.Minutes);
Console.WriteLine(second);
Console.WriteLine(first == new Job("Pack", 30));

Size a = new Size();
a.Width = 2;
Size b = a;
b.Width = 9;
Console.WriteLine(a.Width);

Box boxA = new Box();
Box boxB = new Box();
Console.WriteLine(boxA == boxB);

record Job(string Title, int Minutes);

struct Size
{
    public int Width { get; set; }
}

class Box
{
    public int Width { get; set; }
}
