import { FileType, FileTypeRelPath } from './constants';
import {
  TextDocument,
  RelativePattern,
  workspace,
  Position,
  CancellationToken,
  GlobPattern,
  Uri,
} from 'vscode';

export const gitignores = {};

export function dectFileType(filePath: string): FileType {
  for (const [key, value] of FileTypeRelPath) {
    if (filePath.indexOf(value) >= 0) {
      return key;
    }
  }
  return FileType.Unkown;
}

export function isPositionInString(
  document: TextDocument,
  position: Position
): boolean {
  const lineText = document.lineAt(position.line).text;
  const lineTillCurrentPosition = lineText.substr(0, position.character);

  // Count the number of double quotes in the line till current position. Ignore escaped double quotes
  let doubleQuotesCnt = (lineTillCurrentPosition.match(/\"/g) || []).length;
  const escapedDoubleQuotesCnt = (lineTillCurrentPosition.match(/\\\"/g) || [])
    .length;

  doubleQuotesCnt -= escapedDoubleQuotesCnt;
  return doubleQuotesCnt % 2 === 1;
}

export function flatten(arr) {
  return arr.reduce((flat, toFlatten) => {
    return flat.concat(
      Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten
    );
  }, []);
}

/**
 * findFiles in root of document and repect gitignore
 */
export function findFiles(
  document: TextDocument,
  include: string,
  exclude?: GlobPattern | null,
  maxResults?: number,
  token?: CancellationToken
): Thenable<Uri[]> {
  const ws = workspace.getWorkspaceFolder(document.uri);
  const name = ws.name;
  const _include = new RelativePattern(ws, include);
  const _exclude =
    gitignores[name] && exclude ? gitignores[name].concat(exclude) : exclude;
  return workspace.findFiles(_include, _exclude, maxResults, token);
}
