export type Player = {
  id: string;
  pseudo: string;
  created_at: string;
};

export type EventItem = {
  id: string;
  name: string;
  order_index: number;
};

export type MatchItem = {
  id: string;
  event_id: string;
  player_a_id: string;
  player_b_id: string;
  winner_id: string | null;
  scheduled_at: string | null;
  player_a_pseudo?: string;
  player_b_pseudo?: string;
  winner_pseudo?: string | null;
};

export type ScoreItem = {
  id: string;
  event_id: string;
  player_id: string;
  points: number;
  player_pseudo?: string;
};

export type EventRankingRow = {
  player_id: string;
  pseudo: string;
  total_points: number;
};

export type GlobalRankingRow = {
  player_id: string;
  pseudo: string;
  total_points: number;
};

export type BeerPongState = {
  event_id: string;
  draw_player_ids: string[];
  semi1_winner_key: "A" | "B" | null;
  semi2_winner_key: "C" | "D" | null;
};
