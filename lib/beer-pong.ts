import type { Player } from "@/lib/types";

export type BeerPongTeam = {
  key: string;
  label: string;
  players: [string, string, string];
  playerIds: [string, string, string];
};

export function shuffleArray<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

export function buildBeerPongTeamsFromPlayers(players: Player[]): BeerPongTeam[] {
  const ids = players.map((player) => player.id);
  const names = players.map((player) => player.pseudo);
  return [
    {
      key: "A",
      label: "Équipe A",
      players: [names[0], names[1], names[2]],
      playerIds: [ids[0], ids[1], ids[2]]
    },
    {
      key: "B",
      label: "Équipe B",
      players: [names[3], names[4], names[5]],
      playerIds: [ids[3], ids[4], ids[5]]
    },
    {
      key: "C",
      label: "Équipe C",
      players: [names[6], names[7], names[8]],
      playerIds: [ids[6], ids[7], ids[8]]
    },
    {
      key: "D",
      label: "Équipe D",
      players: [names[9], names[10], names[11]],
      playerIds: [ids[9], ids[10], ids[11]]
    }
  ];
}

export function buildBeerPongPlaceholderTeams(): BeerPongTeam[] {
  return [
    {
      key: "A",
      label: "Équipe A",
      players: ["Joueur 1", "Joueur 2", "Joueur 3"],
      playerIds: ["p1", "p2", "p3"]
    },
    {
      key: "B",
      label: "Équipe B",
      players: ["Joueur 4", "Joueur 5", "Joueur 6"],
      playerIds: ["p4", "p5", "p6"]
    },
    {
      key: "C",
      label: "Équipe C",
      players: ["Joueur 7", "Joueur 8", "Joueur 9"],
      playerIds: ["p7", "p8", "p9"]
    },
    {
      key: "D",
      label: "Équipe D",
      players: ["Joueur 10", "Joueur 11", "Joueur 12"],
      playerIds: ["p10", "p11", "p12"]
    }
  ];
}
