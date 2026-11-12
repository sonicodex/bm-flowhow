// Comparison key for names that must be unique regardless of case.
// SQLite's NOCASE folds ASCII only ("Almacén" ≠ "ALMACÉN"), so the app
// computes the key and the schema puts UNIQUE on it. Accents still count:
// "Almacen" and "Almacén" are different names.
export function nameKey(name: string): string {
  return name.trim().normalize("NFC").toLocaleLowerCase("es-CO");
}
