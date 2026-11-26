public class Board
{
    public string Name { get; }
    public int Open { get; private set; }

    public Board(string name)
    {
        Name = name;
        Open = 0;
    }

    public void Arrive(int count)
    {
        Open += count;
    }

    public void Finish()
    {
        if (Open == 0)
        {
            return;
        }
        Open--;
    }
}
