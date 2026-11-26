int open = 3;
int limit = 3;
if (open > limit)
{
    Console.WriteLine("over");
}
else if (open == limit)
{
    Console.WriteLine("full");
}
else
{
    Console.WriteLine("room");
}

bool urgent = true;
bool blocked = false;
Console.WriteLine(urgent && !blocked);
Console.WriteLine(open >= 5 || urgent);
