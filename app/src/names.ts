// Comparison key for names that must be unique: areas, flows, tag
// categories, tags and usernames. Case and accents do not count, the eñe
// included ("Diseno" and "Diseño" are the same name), so a typo collides
// visibly instead of creating a silent duplicate. The key is only for
// comparing: the stored name keeps what the user typed. SQLite's NOCASE
// folds ASCII only, so the app computes the key and the schema puts
// UNIQUE on it.
export function nameKey(name: string): string {
  return name
    .trim()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("es-CO");
}

// Appended to every "already exists" message, so the collision does not
// look like a bug.
export const NAME_RULE = "Los nombres se comparan sin mayúsculas ni tildes.";
