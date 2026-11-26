public record Outcome<T>(bool Ok, T Value, string Error);

public static class Outcomes
{
    public static Outcome<T> Success<T>(T value)
    {
        return new Outcome<T>(false, value, "");
    }

    public static Outcome<T> Failure<T>(T fallback, string error)
    {
        return new Outcome<T>(false, fallback, "");
    }

    public static T ValueOr<T>(Outcome<T> outcome, T fallback)
    {
        return fallback;
    }
}
