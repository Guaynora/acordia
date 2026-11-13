import { type Key, formatKey, parseKey } from "./key.js";
import { transposeSymbol } from "./transpose.js";

export interface ChordError {
  readonly line: number;
  readonly column: number;
  readonly symbol: string;
  readonly message: string;
}

export interface TransposeResult {
  readonly text: string;
  readonly errors: readonly ChordError[];
}

const CHORD_IN_BRACKETS = /\[([^\]]*)\]/g;
const KEY_DIRECTIVE = /^\s*\{\s*key\s*:\s*([^}]*)\}\s*$/i;
const DIRECTIVE = /^\s*\{.*\}\s*$/;

/** Reads the {key: ...} directive of a ChordPro song. */
export function readKey(source: string): Key | null {
  for (const line of source.split("\n")) {
    const match = KEY_DIRECTIVE.exec(line);
    if (match) return parseKey(match[1] ?? "");
  }
  return null;
}

/** Lists every bracketed chord that the parser does not recognize. */
export function validateChordPro(source: string, key: Key): ChordError[] {
  return transposeChordPro(source, key, key).errors.slice();
}

/**
 * Transposes every [chord] in a ChordPro song and rewrites its {key}
 * directive. Bracketed annotations that start with "*" are left as they are.
 */
export function transposeChordPro(source: string, from: Key, to: Key): TransposeResult {
  const errors: ChordError[] = [];
  const lines = source.split("\n").map((line, index) => {
    if (KEY_DIRECTIVE.test(line)) return line.replace(/(:\s*)[^}]*?(\s*\})/, `$1${formatKey(to)}$2`);
    if (DIRECTIVE.test(line)) return line;
    return line.replace(CHORD_IN_BRACKETS, (whole, symbol: string, offset: number) => {
      if (symbol.startsWith("*") || symbol.trim() === "") return whole;
      const result = transposeSymbol(symbol, from, to);
      if (!result.ok) {
        errors.push({ line: index + 1, column: offset + 1, symbol, message: result.error });
      }
      return `[${result.text}]`;
    });
  });
  return { text: lines.join("\n"), errors };
}
