public static int TextLength(Note? note)
{
    if (note == null)
    {
        return 0;
    }
    return note.Text.Length;
}
