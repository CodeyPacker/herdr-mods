ISource source = new EmptySource();
Console.WriteLine(source.Name);

interface ISource
{
    string Name { get; }
    int Count();
}

class EmptySource : ISource
{
    public string Name => "empty";
}
