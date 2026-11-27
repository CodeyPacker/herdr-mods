type User = ReturnType<typeof makeUser>;
function promote(user: User): User {
  return { name: user.name, age: user.age, admin: true };
}
