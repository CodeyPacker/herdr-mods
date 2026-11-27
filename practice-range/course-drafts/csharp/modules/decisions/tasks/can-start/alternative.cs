bool ready = true;
if (!paid)
{
    ready = false;
}
if (closed)
{
    ready = false;
}
if (riders <= 0)
{
    ready = false;
}
