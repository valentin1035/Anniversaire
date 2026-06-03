import fs from "fs";
import path from "path";

const target = path.join(process.cwd(), ".next");

try {
  fs.rmSync(target, { recursive: true, force: true });
  console.log(`Cache supprimé : ${target}`);
} catch {
  console.warn(
    "Impossible de supprimer .next — arrête tous les \"npm run dev\" (Ctrl+C), puis relance npm run dev:clean"
  );
}
