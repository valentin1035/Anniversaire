const EVENT_NAMES: Record<number, string> = {
  1: "Beer Pong Géant",
  2: "Molkpute",
  3: "Golf Débile",
  4: "100% Débile"
};

export function getEventDisplayName(orderIndex: number, fallbackName: string) {
  return EVENT_NAMES[orderIndex] ?? fallbackName;
}

export function getAllEventNames() {
  return EVENT_NAMES;
}
