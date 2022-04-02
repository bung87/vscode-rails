import path, { posix } from 'path';
import { PATTERNS } from '../constants';
import { wordsToPath } from '../utils';
import { FileType2Path, FileType } from './file';
export const Controllers = posix.join('app', 'controllers');
export const Models = posix.join('app', 'models');
export const Views = posix.join('app', 'views');
export const Layouts = posix.join('app', 'views', 'layouts');
export const Helpers = posix.join('app', 'helpers');
export const Javascripts = posix.join('app', 'assets', 'javascripts');
export const Stylesheets = posix.join('app', 'assets', 'stylesheets');
export const Spec = 'spec';
export const Test = 'test';
export const ControllersConcerns = posix.join('app', 'controllers', 'concerns');
export const ModelsConcerns = posix.join('app', 'models', 'concerns');

/**
 *
 * @param relpath
 * @param line
 * @param fileType
 * @return relative file path
 */
export function getSymbolPath(
  relpath: string,
  line: string,
  fileType: FileType
) {
  console.log(`getSymbolPath`, arguments);
  let filePath = '';
  const [currentClassRaw, parentClassRaw] = line.split('<'),
    currentClass = currentClassRaw.trim(),
    parentClass = parentClassRaw.trim(),
    relPath = FileType2Path.get(fileType);
  if (currentClass.includes('::') && !parentClass.includes('::')) {
    return path.join(relPath, wordsToPath(parentClass) + '.rb');
  }
  const parent = parentClass.trim(),
    sameModuleSub = path.dirname(relpath.substring(relPath.length + 1)),
    seq = parent
      .split('::')
      .map(wordsToPath)
      .filter((v) => v !== ''),
    sub = !parent.includes('::')
      ? sameModuleSub
      : seq.slice(0, -1).join(path.sep),
    name = seq[seq.length - 1];
  filePath = path.join(relPath, sub, name + '.rb');
  console.log(`getSymbolPath return`, filePath);
  return filePath;
}

export function getConcernsFilePath(lineStartToWord: string, fileT: FileType) {
  console.log(`getConcernsFilePath`, arguments);
  const concern = lineStartToWord.replace(PATTERNS.INCLUDE_DECLARATION, ''),
    seq = concern.split('::').map(wordsToPath);
  if (seq[0] === 'concerns') delete seq[0];
  const sub = seq.slice(0, -1).join(path.sep),
    name = seq[seq.length - 1],
    fileType = FileType2Path.get(fileT),
    filePath = path.join(fileType, sub, name + '.rb');
  return filePath;
}
