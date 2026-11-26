string status = "room";
if (open == 0)
{
    status = "empty";
}
else if (open >= limit)
{
    status = "full";
}
