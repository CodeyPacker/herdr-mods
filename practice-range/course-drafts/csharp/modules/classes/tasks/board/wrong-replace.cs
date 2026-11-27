public class Bus
{
    public string Route { get; }
    public int Riders { get; private set; }

    public Bus(string route)
    {
        Route = route;
    }

    public void GetOn(int count)
    {
        Riders = count;
    }

    public void GetOff()
    {
        if (Riders > 0)
        {
            Riders = Riders - 1;
        }
    }
}
