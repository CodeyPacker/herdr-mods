public class Board
{
    public string Name { get; }
    public int Open { get; private set; }

    public Board(string name)
    {
        Name = name;
    }

    public void Arrive(int count)
    {
        Open = count;
    }

    public void Finish()
    {
        if (Open > 0)
        {
            Open = Open - 1;
        }
    }
}
