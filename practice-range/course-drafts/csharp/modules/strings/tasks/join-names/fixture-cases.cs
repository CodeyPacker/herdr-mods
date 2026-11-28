public static class Given
{
    public static bool InputWasPreserved(Func<List<string>, string> candidate)
    {
        List<string> input = new List<string> { " A ", " ", "B" };
        candidate(input);
        return input.Count == 3 && input[0] == " A " && input[1] == " " && input[2] == "B";
    }
}
