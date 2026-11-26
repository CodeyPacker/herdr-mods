public record Outcome<T>(bool Ok, T Value, string Error);

public static class Outcomes
{
    public static Outcome<T> Success<T>(T value) => new Outcome<T>(true, value, "");

    public static Outcome<T> Failure<T>(T fallback, string error) => Success(fallback) with { Ok = false, Error = error };

    public static T ValueOr<T>(Outcome<T> outcome, T fallback) => outcome.Ok ? outcome.Value : fallback;
}
