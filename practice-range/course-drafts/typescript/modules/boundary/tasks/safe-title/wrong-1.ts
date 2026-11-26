function safeTitle(value: unknown): string | null {
  return (value as {title:string}).title;
}
