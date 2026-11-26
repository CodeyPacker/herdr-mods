List<ISource> sources = new List<ISource> { new FixedSource(3), new EmptySource() };
foreach (ISource source in sources)
{
    Console.WriteLine($"{source.Name}: {source.Count()}");
}

Notice notice = new UrgentNotice("Ship");
Console.WriteLine(notice.Text());

interface ISource
{
    string Name { get; }
    int Count();
}

class FixedSource : ISource
{
    public int Size { get; }

    public FixedSource(int size)
    {
        Size = size;
    }

    public string Name => "fixed";
    public int Count() => Size;
}

class EmptySource : ISource
{
    public string Name => "empty";
    public int Count() => 0;
}

class Notice
{
    public string Title { get; }

    public Notice(string title)
    {
        Title = title;
    }

    public virtual string Text() => Title;
}

class UrgentNotice : Notice
{
    public UrgentNotice(string title) : base(title)
    {
    }

    public override string Text() => $"{Title}!";
}
