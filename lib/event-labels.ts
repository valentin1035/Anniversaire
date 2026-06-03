export function getEventDisplayName(orderIndex: number, fallbackName: string) {
  if (orderIndex === 1) {
    return "Beer Pong Géant";
  }
  return fallbackName;
}
