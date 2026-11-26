int[] minutes = { 30, 15, 45 };
int total = 0;
foreach (int value in minutes)
{
    total = total + value;
}
Console.WriteLine(total);
Console.WriteLine(minutes.Length);
Console.WriteLine(minutes[0]);
