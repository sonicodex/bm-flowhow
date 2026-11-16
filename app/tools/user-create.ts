// Creates a Board user, or resets a user's password, from the command line,
// outside the Worker. It is how the first Board member gets in (there is no
// open sign-up, SPEC §4) and the way back in if the Board is locked out.
// Everyone else is created by the Board from the app's screens.
//
// Run from app/:
//   npm run user:create -- --usuario ana --nombre "Ana Gómez"
//   npm run user:create -- --usuario ana --restablecer
// Add --remote to write to the deployed D1 instead of the local one.
//
// The password is asked twice without echo, and hashed here with the same
// src/password.ts the Worker uses. Only the hash leaves this process.
import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { nameKey } from "../src/names.ts";
import { hashPassword, passwordError } from "../src/password.ts";

const USAGE = `Uso:
  npm run user:create -- --usuario <usuario> --nombre "<nombre completo>" [--remote]
  npm run user:create -- --usuario <usuario> --restablecer [--remote]`;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

let args;
try {
  args = parseArgs({
    options: {
      usuario: { type: "string" },
      nombre: { type: "string" },
      restablecer: { type: "boolean", default: false },
      remote: { type: "boolean", default: false },
    },
    strict: true,
  }).values;
} catch (e) {
  fail(`${e instanceof Error ? e.message : e}\n${USAGE}`);
}

const username = nameKey(args.usuario ?? "");
const fullName = (args.nombre ?? "").trim();
if (!username) fail(USAGE);
if (args.restablecer && fullName) fail(`--restablecer no lleva --nombre.\n${USAGE}`);
if (!args.restablecer && !fullName) fail(USAGE);
const where = args.remote ? "--remote" : "--local";

// Values go into the SQL as quoted literals: wrangler d1 execute takes no
// parameters. Only names and the hash go in, and quotes are doubled.
const literal = (text: string) => `'${text.replace(/'/g, "''")}'`;

function d1(sql: string): Record<string, unknown>[] {
  // No shell: the SQL is one argument, whatever it contains.
  const out = execFileSync("npx", ["wrangler", "d1", "execute", "DB", where, "--json", "--command", sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  return (JSON.parse(out) as { results: Record<string, unknown>[] }[])[0]?.results ?? [];
}

// Reads one line without echoing it when typed at a terminal.
function ask(question: string): Promise<string> {
  const input = process.stdin;
  process.stdout.write(question);
  input.setRawMode(true);
  input.resume();
  input.setEncoding("utf8");
  return new Promise((resolve) => {
    let typed = "";
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\u0003") {
          process.stdout.write("\n");
          process.exit(130);
        } else if (ch === "\r" || ch === "\n") {
          input.setRawMode(false);
          input.pause();
          input.off("data", onData);
          process.stdout.write("\n");
          resolve(typed);
          return;
        } else if (ch === "\u007f" || ch === "\b") {
          typed = [...typed].slice(0, -1).join("");
        } else {
          typed += ch;
        }
      }
    };
    input.on("data", onData);
  });
}

// Piped input (a script, a test): one line per prompt, nothing to hide.
const piped = !process.stdin.isTTY ? createInterface({ input: process.stdin })[Symbol.asyncIterator]() : null;
const read = async (question: string) => (piped ? ((await piped.next()).value ?? "") : ask(question));

const existing = d1(`SELECT id, full_name FROM users WHERE username = ${literal(username)}`)[0];
if (args.restablecer && !existing) fail(`No existe el usuario «${username}».`);
if (!args.restablecer && existing) fail(`Ya existe el usuario «${username}». Para cambiarle la contraseña usa --restablecer.`);

const password = await read("Contraseña: ");
const tooShort = passwordError(password);
if (tooShort) fail(tooShort);
if ((await read("Repítela: ")) !== password) fail("Las dos contraseñas no coinciden. No se cambió nada.");
const hash = await hashPassword(password);

if (args.restablecer) {
  // The new password closes every session open with the old one. Whoever
  // runs this typed it themselves, so it is not temporary.
  d1(
    `UPDATE users SET password_hash = ${literal(hash)}, must_change_password = 0 WHERE id = ${Number(existing!.id)};
     DELETE FROM sessions WHERE user_id = ${Number(existing!.id)};`,
  );
  console.log(`Contraseña de «${username}» cambiada (${args.remote ? "D1 remoto" : "D1 local"}). Sus sesiones abiertas se cerraron.`);
} else {
  // A Board member: every permission, no area (SPEC §4).
  d1(
    `INSERT INTO users (username, full_name, password_hash, role, can_edit, can_view_admin_layer, can_manage_users)
     VALUES (${literal(username)}, ${literal(fullName)}, ${literal(hash)}, 'board', 1, 1, 1)`,
  );
  console.log(`Usuario «${username}» creado en la Junta directiva (${args.remote ? "D1 remoto" : "D1 local"}).`);
}
process.exit(0);
