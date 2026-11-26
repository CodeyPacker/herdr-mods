List<int> minutes = new List<int> { 10, 40 };
var longOnes = minutes.Where(value => value > 30);
var saved = minutes.Where(value => value > 30).ToList();
minutes.Add(50);
Console.WriteLine(longOnes.Count());
Console.WriteLine(saved.Count);
