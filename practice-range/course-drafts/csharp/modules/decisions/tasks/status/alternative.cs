string status;
if (open != 0 && open < limit)
{
    status = "room";
}
else if (open != 0)
{
    status = "full";
}
else
{
    status = "empty";
}
