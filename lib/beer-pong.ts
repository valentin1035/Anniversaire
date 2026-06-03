import type { Player } from "@/lib/types";

export type BeerPongTeam = {
  key: string;
  label: string;
  players: [string, string, string];
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
  const names = players.map((player) => player.pseudo);
  return [
    {
      key: "A",
      label: "Équipe A",
      players: [names[0], names[1], names[2]]
    },
    {
      key: "B",
      label: "Équipe B",
      players: [names[3], names[4], names[5]]
    },
    {
      key: "C",
      label: "Équipe C",
      players: [names[6], names[7], names[8]]
    },
    {
      key: "D",
      label: "Équipe D",
      players: [names[9], names[10], names[11]]
    }
  ];
}

export function buildBeerPongPlaceholderTeams(): BeerPongTeam[] {
  return [
    {
      key: "A",
      label: "Équipe A",
      players: ["Joueur 1", "Joueur 2", "Joueur 3"]
    },
    {
      key: "B",
      label: "Équipe B",
      players: ["Joueur 4", "Joueur 5", "Joueur 6"]
    },
    {
      key: "C",
      label: "Équipe C",
      players: ["Joueur 7", "Joueur 8", "Joueur 9"]
    },
    {
      key: "D",
      label: "Équipe D",
      players: ["Joueur 10", "Joueur 11", "Joueur 12"]
    }
  ];
}
