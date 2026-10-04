import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS = join(process.cwd(), "supabase/migrations");

/** Tables that live in `public` and are therefore unsafe to name unqualified. */
const PUBLIC_TABLES = [
  "team_accounts",
  "team_account_invites",
  "teams",
  "organizations",
  "organization_members",
  "fixtures",
  "players",
];

type Fn = { file: string; name: string; options: string; body: string };

/**
 * Drop `--` line comments and /* block *\/ comments. A table named in a
 * comment is prose, not a reference, and flagging it would train people to
 * ignore the audit.
 */
function stripComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
}

/**
 * Extract every CREATE FUNCTION, splitting the declaration (where
 * SECURITY DEFINER and search_path live) from the $$ body.
 */
function readFunctions(): Fn[] {
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql"));
  const out: Fn[] = [];
  const header = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([\w.]+)/gi;

  for (const file of files) {
    const src = readFileSync(join(MIGRATIONS, file), "utf8");
    let m: RegExpExecArray | null;
    while ((m = header.exec(src)) !== null) {
      const open = src.indexOf("$$", m.index);
      const close = open === -1 ? -1 : src.indexOf("$$", open + 2);
      if (open === -1 || close === -1) continue;
      out.push({
        file,
        name: m[1],
        options: stripComments(src.slice(m.index + m[0].length, open)),
        body: stripComments(src.slice(open + 2, close)),
      });
    }
  }
  return out;
}

const functions = readFunctions();

/**
 * A SECURITY DEFINER function runs as its owner, so anything it names without
 * a schema is resolved against a caller-influenced search_path. Setting
 * search_path = '' closes that, but only if every reference is qualified — one
 * unqualified name then fails at runtime with "relation does not exist", which
 * is exactly how the coach invite claim was silently broken before this check
 * existed.
 */
describe("migration SECURITY DEFINER audit", () => {
  it("finds functions to check", () => {
    expect(functions.length).toBeGreaterThan(0);
  });

  it.each(functions.map((f) => [f.file, f.name, f] as const))(
    "%s :: %s pins an empty search_path when SECURITY DEFINER",
    (_file, _name, fn) => {
      if (!/SECURITY\s+DEFINER/i.test(fn.options)) return;
      expect(fn.options).toMatch(/search_path\s*=\s*''/i);
    }
  );

  it.each(functions.map((f) => [f.file, f.name, f] as const))(
    "%s :: %s schema-qualifies every public table it names",
    (_file, _name, fn) => {
      if (!/SECURITY\s+DEFINER/i.test(fn.options)) return;
      if (!/search_path\s*=\s*''/i.test(fn.options)) return;

      const unqualified = PUBLIC_TABLES.filter((t) =>
        // Not preceded by a dot (public.x), not part of a longer identifier,
        // and not the table's own name in a CREATE/DROP statement.
        new RegExp(`(?<![\\w.])${t}(?![\\w(])`).test(fn.body)
      );
      expect(unqualified).toEqual([]);
    }
  );
});
