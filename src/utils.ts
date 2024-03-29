import {
  TextDocument,
  RelativePattern,
  workspace,
  Position,
  CancellationToken,
  Range,
  Uri,
} from 'vscode';
import path from 'path';
import inflection from 'inflection2';
import { Rails } from './rails';
import { FileType } from './rails/file';

export const LocalBundle = 'vendor/bundle/**';
export const gitignores: Record<string, string[]> = {};

export function dectFileType(filePath: string): FileType {
  for (const [key, value] of Rails.FileType2Path) {
    if (filePath.indexOf(value) >= 0) {
      return key;
    }
  }
  return FileType.Unkown;
}

export function wordsToPath(s: string) {
  return inflection.underscore(
    s.replace(/[A-Z]{2,}(?![a-z])/, (s) => {
      return inflection.titleize(s);
    })
  );
}

export function flatten<T>(arr: T[][]): T[] {
  return ([] as T[]).concat(...arr);
}

type NestedArray<T> = Array<NestedArray<T> | T>;

export function flattenDeep<T>(input: NestedArray<T>): T[] {
  return flatten(input.map((x) => (Array.isArray(x) ? flattenDeep(x) : [x])));
}

export function toPosixPath(s: string): string {
  return s.split(path.sep).join(path.posix.sep);
}

/**
 * findFiles in root of document and repect gitignore
 */
export function findFiles(
  document: TextDocument,
  include: string,
  exclude?: string,
  maxResults?: number,
  token?: CancellationToken
): Thenable<Uri[]> {
  const ws = workspace.getWorkspaceFolder(document.uri);
  const name = ws.name;
  const _include = new RelativePattern(ws, toPosixPath(include));
  const _exclude =
    gitignores[name] && exclude ? gitignores[name].concat(exclude) : [exclude];
  return workspace.findFiles(
    _include,
    _exclude.concat(LocalBundle).join(','),
    maxResults,
    token
  );
}

/**
 * ...Word -> A::B::Word
 */
export function getSymbol(
  document: TextDocument,
  position: Position
): string | undefined {
  const wordRange = document.getWordRangeAtPosition(position);
  if (!wordRange) {
    return void 0;
  }
  const word = document.getText(wordRange);
  if (!word) {
    return void 0;
  }
  const lineStartToWord = document
    .getText(new Range(new Position(position.line, 0), wordRange.end))
    .trim();
  const r = new RegExp('(((::)?[A-Za-z]+)*(::)?' + word + ')').exec(
    lineStartToWord
  );
  if (r.length >= 2) {
    return r[1];
  }
}

/**
 *
 * @param symbol A::B::Word
 * @returns lowercase name and sub path
 */
export function getSubPathBySymbol(symbol: string): [string, string] {
  const seq = symbol
      .split('::')
      .map(wordsToPath)
      .filter((v) => v !== ''),
    sub = seq.slice(0, -1).join(path.sep),
    name = seq[seq.length - 1];
  return [name, sub];
}
