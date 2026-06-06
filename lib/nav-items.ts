import type { LucideIcon } from "lucide-react";
import { Beer, Flag, Home, Laugh, Lock, Trees, Trophy } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Accueil", shortLabel: "Accueil", icon: Home },
  { href: "/epreuves/1", label: "Beer Pong Géant", shortLabel: "Beer Pong", icon: Beer },
  { href: "/epreuves/2", label: "Molkpute", shortLabel: "Molkpute", icon: Trees },
  { href: "/epreuves/3", label: "Golf Débile", shortLabel: "Golf", icon: Flag },
  { href: "/epreuves/4", label: "100% Débile", shortLabel: "100%", icon: Laugh },
  { href: "/classement", label: "Classement Global", shortLabel: "Classement", icon: Trophy },
  { href: "/admin", label: "Admin", shortLabel: "Admin", icon: Lock }
];
