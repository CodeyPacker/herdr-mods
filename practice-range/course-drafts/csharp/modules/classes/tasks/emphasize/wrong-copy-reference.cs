public class Label
{
    public string Text { get; set; }

    public Label(string text)
    {
        Text = text;
    }
}

public static class Labels
{
    public static Label Emphasize(Label label)
    {
        Label copy = label;
        copy.Text = copy.Text + "!";
        return copy;
    }
}
