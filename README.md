# Site anniversaire - compétition 5 épreuves

Application web responsive avec:
- inscription sans email (pseudo unique),
- classement global,
- pages par épreuve,
- panneau admin pour gérer matchs et points.

## Stack

- `Next.js` (frontend + API)
- `Supabase` (PostgreSQL + RLS)
- `Vercel` (hébergement)

## 1) Prérequis local

Il faut installer Node.js complet (avec `npm`) sur ta machine.

Vérification:

```bash
node -v
npm -v
```

## 2) Installation

```bash
npm install
cp .env.example .env.local
```

Puis remplir `.env.local` avec les valeurs Supabase + mot de passe admin.

## 3) Base de données Supabase

1. Crée un projet Supabase.
2. Ouvre l'éditeur SQL.
3. Copie/colle le contenu de `supabase/schema.sql`.
4. Exécute le script.

Le script crée:
- tables `players`, `events`, `matches`, `scores`,
- vue `global_ranking`,
- politiques RLS en lecture publique.

## 4) Lancer en local

```bash
npm run dev
```

Ensuite ouvre [http://localhost:3000](http://localhost:3000).

## 5) Utilisation rapide

- **Joueur**: inscription avec un pseudo unique.
- **Connexion**: le pseudo suffit (il sert aussi de « code secret »).
- **Admin**: `/admin` + `ADMIN_PASSWORD`.
- **Admin actions**:
  - créer des matchs,
  - définir le gagnant d'un match,
  - ajouter des points par épreuve.

## 6) Déploiement Vercel

1. Crée un repo GitHub avec ce projet.
2. Sur Vercel:
   - `Add New Project`,
   - sélectionne le repo,
   - ajoute les variables d'environnement de `.env.example`.
3. Déploie.

À chaque `git push`, Vercel redéploie automatiquement.

## 7) Sécurité minimale incluse

- Validation pseudo côté serveur.
- Session joueur et admin via cookies HTTP-only signés.
- Écriture en base via service role uniquement (côté serveur).

## 8) Améliorations possibles

- Export CSV du classement.
- Historique des matchs terminés.
- Timer / planning par épreuve.
- Tableau admin par glisser-déposer.
