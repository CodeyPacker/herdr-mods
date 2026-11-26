public record Outcome<T>(bool Ok, T Value, string Error);

public static class Outcomes
{
    public static Outcome<T> Success<T>(T value)
    {
        return new Outcome<T>(true, value, "");
    }

    public static Outcome<T> Failure<T>(T fallback, string error)
    {
        return new Outcome<T>(true, fallback, error);
    }

    public static T ValueOr<T>(Outcome<T> outcome, T fallback)
    {
        if (outcome.Ok)
        {
            return outcome.Value;
        }
        return fallback;
    }
}
