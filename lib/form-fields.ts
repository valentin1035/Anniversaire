/** Lit un champ texte depuis FormData sans jamais passer `undefined` à la couche métier. */
export function readFormText(formData: FormData, name: string): string {
  const raw = formData.get(name);
  if (typeof raw === "string") {
    return raw;
  }
  return "";
}
