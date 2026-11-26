Dictionary<string, int> open = new Dictionary<string, int>();
open["Ana"] = 2;
open["Ben"] = 1;
open["Ana"] = open["Ana"] + 1;
Console.WriteLine(open["Ana"]);
Console.WriteLine(open.Count);
Console.WriteLine(open.ContainsKey("Cy"));
if (open.TryGetValue("Cy", out int found))
{
    Console.WriteLine(found);
}
else
{
    Console.WriteLine("no entry");
}

HashSet<string> owners = new HashSet<string>();
owners.Add("Ana");
owners.Add("Ben");
Console.WriteLine(owners.Add("Ana"));
Console.WriteLine(owners.Count);
