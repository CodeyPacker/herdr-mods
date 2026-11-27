public static string Lane(Order order)
{
    if (order.Minutes == 0) return "skip";
    if (order.Urgent) return "now";
    if (order.Minutes < 30) return "quick";
    return "plan";
}
