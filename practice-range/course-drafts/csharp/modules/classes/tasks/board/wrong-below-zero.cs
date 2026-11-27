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
        Riders = Riders + count;
    }

    public void GetOff()
    {
        Riders = Riders - 1;
    }
}
