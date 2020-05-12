import { FileType, FileTypeRelPath } from './constants';
import vscode = require('vscode');

export function dectFileType(filePath: string): FileType {
  for (const [key, value] of FileTypeRelPath) {
    if (filePath.indexOf(value) >= 0) {
      return key;
    }
  }
  return FileType.Unkown;
}

export function isPositionInString(
  document: vscode.TextDocument,
  position: vscode.Position
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
  return arr.reduce( (flat, toFlatten) => {
    return flat.concat(
      Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten
    );
  }, []);
}
