function nicknameOf(profile: Profile): string {
  if (profile.nickname === null) return "No nickname";
  return String(profile.nickname);
}
