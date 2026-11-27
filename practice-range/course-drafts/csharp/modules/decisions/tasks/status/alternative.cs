string status;
if (cars != 0 && cars < spaces)
{
    status = "room";
}
else if (cars != 0)
{
    status = "full";
}
else
{
    status = "empty";
}
