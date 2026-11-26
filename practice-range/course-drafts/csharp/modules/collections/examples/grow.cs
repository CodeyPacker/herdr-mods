List<string> titles = new List<string>();
titles.Add("Pack");
titles.Add("Ship");
Console.WriteLine(titles.Count);
for (int i = 0; i < titles.Count; i++)
{
    Console.WriteLine($"{i}: {titles[i]}");
}
