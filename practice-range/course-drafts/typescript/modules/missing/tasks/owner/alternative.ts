function nicknameOf(profile: Profile): string {
  if (profile.nickname === undefined || profile.nickname === null) return "No nickname";
  return profile.nickname;
}
