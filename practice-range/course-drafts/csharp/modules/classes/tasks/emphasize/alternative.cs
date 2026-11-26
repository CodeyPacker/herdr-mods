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
        Label result = new Label(label.Text);
        result.Text = $"{result.Text}!";
        return result;
    }
}
