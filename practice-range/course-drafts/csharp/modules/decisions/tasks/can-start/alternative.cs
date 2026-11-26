bool ready = true;
if (!assigned)
{
    ready = false;
}
if (blocked)
{
    ready = false;
}
if (minutes <= 0)
{
    ready = false;
}
