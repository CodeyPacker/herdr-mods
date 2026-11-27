type User = { name: string; age: number };
function promote(user: User): User {
  return { ...user };
}
