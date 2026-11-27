type User = ReturnType<typeof makeUser>;
function promote(user: User): User {
  user.admin = true;
  return user;
}
