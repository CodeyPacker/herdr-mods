string status = "room";
if (open >= limit)
{
    status = "full";
}
else if (open == 0)
{
    status = "empty";
}
