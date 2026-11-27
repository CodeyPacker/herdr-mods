type User = ReturnType<typeof makeUser>;
function promote(user: User): User {
  return { ...user, admin: true };
}
