'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { dectFileType } from './utils';
import { RailsHelper } from './rails_helper';
import {
  FileType,
  FileTypeRelPath,
  REL_CONTROLLERS,
  // REL_CONTROLLERS_CONCERNS,
  REL_MODELS,
  // REL_MODELS_CONCERNS,
  REL_VIEWS,
  REL_LAYOUTS,
  // REL_HELPERS,
  // REL_JAVASCRIPTS,
  REL_STYLESHEETS,
  PATTERNS,
} from './constants';
import { RAILS } from './symbols/rails';
import { RUBY } from './symbols/ruby';
import * as inflection from 'inflection2';
import * as readline from 'readline';
import { RailsDefinitionInformation } from './interfaces';

const missingFilelMsg = 'Missing file: ';
const couldNotOpenMsg = 'Could Not Open file: ';
const SYMBOL_END = '[^\\w]';

function wordsToPath(s) {
  return inflection.underscore(
    s.replace(/[A-Z]{2,}(?![a-z])/, (s) => {
      return inflection.titleize(s);
    })
  );
}

export function getConcernsFilePath(lineStartToWord, fileT: FileType) {
  const concern = lineStartToWord.replace(PATTERNS.INCLUDE_DECLARATION, ''),
    seq = concern.split('::').map(wordsToPath);
  if (seq[0] === 'concerns') delete seq[0];
  const sub = seq.slice(0, -1).join(path.sep),
    name = seq[seq.length - 1],
    fileType = FileTypeRelPath.get(fileT),
    filePath = path.join(fileType, sub, name + '.rb');
  return filePath;
}

export function findClassInDocumentCallback(name, document) {
  const line = document
      .getText()
      .split('\n')
      .findIndex((line) =>
        new RegExp(
          '^class\\s+(((::)?[A-Za-z]+)*(::)?' + name + ')' + SYMBOL_END
        ).test(line.trim())
      ),
    definitionInformation = {
      file: document.uri.fsPath,
      line: Math.max(line, 0),
      column: 0,
    };
  return Promise.resolve(definitionInformation);
}

export async function getLibOrModelFilePath(
  lineStartToWord: string,
  word: string
) {
  const symbol = new RegExp('(((::)?[A-Za-z]+)*(::)?' + word + ')').exec(
    lineStartToWord
  )[1];
  const seq = symbol
      .split('::')
      .map(wordsToPath)
      .filter((v) => v !== ''),
    sub = seq.slice(0, -1).join(path.sep),
    name = seq[seq.length - 1],
    filePathInModels = path.join(REL_MODELS, '**', sub, name + '.rb'),
    filePathInLib = name ? path.join('lib', sub, name + '.rb') : '',
    // fileModulePathInLib = name ? path.join("lib", name + ".rb") : "",
    thePath = sub
      ? path.join(vscode.workspace.rootPath, 'lib', sub + '.rb')
      : '',
    demodulized = inflection.demodulize(symbol),
    funcOrClass =
      demodulized.indexOf('.') !== -1 ? demodulized.split('.')[1] : demodulized,
    regPrefix = PATTERNS.CAPITALIZED.test(funcOrClass)
      ? 'class\\s+'
      : 'def\\s+',
    reg = new RegExp(regPrefix + funcOrClass + SYMBOL_END);
  const findInLib = vscode.workspace.findFiles(filePathInLib, null, 1).then(
    (uris: vscode.Uri[]) => {
      if (!uris.length) {
        return thePath
          ? Promise.resolve(findFunctionOrClassByClassNameInFile(thePath, reg))
          : Promise.resolve(null);
      }
      return vscode.workspace
        .openTextDocument(uris[0])
        .then(findClassInDocumentCallback.bind(null, name), () => {
          return Promise.reject(couldNotOpenMsg + filePathInLib);
        });
    },
    () => {
      return thePath
        ? Promise.resolve(findFunctionOrClassByClassNameInFile(thePath, reg))
        : Promise.resolve(null);
    }
  );
  try {
    const uris = await vscode.workspace.findFiles(filePathInModels, null, 1);
    if (!uris.length) {
      return filePathInLib ? findInLib : Promise.resolve(null);
    }
    return vscode.workspace
      .openTextDocument(uris[0])
      .then(findClassInDocumentCallback.bind(null, name), () => {
        return Promise.reject(couldNotOpenMsg + filePathInModels);
      });
  } catch (e) {
    return filePathInLib ? findInLib : Promise.resolve(null);
  }
}

export function findLocationByWord(
  document: vscode.TextDocument,
  position: vscode.Position,
  word: string,
  lineStartToWord: string
) {
  if (PATTERNS.CAPITALIZED.test(word)) {
    return getLibOrModelFilePath(lineStartToWord, word);
  } else {
    const fileNameWithoutSuffix = path.parse(document.fileName).name,
      controllerName = inflection.camelize(fileNameWithoutSuffix);
    return findFunctionOrClassByClassName(
      document,
      position,
      word,
      controllerName
    );
  }
}
/**
 * get view glob
 * @returns glob path or null
 */
export function findViews(
  document: vscode.TextDocument,
  position: vscode.Position,
  word: string,
  lineStartToWord: string
) {
  let filePath;
  const lineText = document.lineAt(position.line).text.trim(),
    match1 = lineStartToWord.match(PATTERNS.RENDER_MATCH),
    match1id = match1[match1.length - 1],
    match2 = lineText.match(PATTERNS.RENDER_MATCH),
    idIndex = match2.findIndex((v) => v.includes(match1id)),
    id = match2[idIndex],
    preWord = match2[idIndex - 1];
  console.log(match1, match2, id, preWord);
  if (
    preWord === 'render' &&
    ['template', 'partial', 'layout', 'json', 'html'].indexOf(id) !== -1
  ) {
    return null;
  }
  const viewPath =
      path.parse(id).dir + path.sep + '*' + path.parse(id).name + '.*',
    sub =
      id.indexOf('/') !== -1
        ? ''
        : vscode.workspace
            .asRelativePath(document.fileName)
            .substring(REL_CONTROLLERS.length + 1)
            .replace('_controller.rb', '');
  if (preWord === 'layout') {
    filePath = path.join(REL_LAYOUTS, viewPath);
  } else {
    filePath = path.join(REL_VIEWS, sub, viewPath);
  }
  console.log(preWord, filePath, match1id, id);
  return filePath;
}

export function controllerDefinitionLocation(
  document: vscode.TextDocument,
  position: vscode.Position,
  word: string,
  lineStartToWord: string
): Thenable<RailsDefinitionInformation> {
  const definitionInformation: RailsDefinitionInformation = {
    file: null,
    line: 0,
    column: 0,
  };
  // if (PATTERNS.CLASS_INHERIT_DECLARATION.test(lineStartToWord)) {
  //   // exclude = REL_CONTROLLERS
  //   // if (parentController === "ActionController::Base") {
  //   // 	//@todo provide rails online doc link
  //   // 	return Promise.reject(missingToolMsg + 'godef');
  //   // }
  //   let filePath = getParentControllerFilePathByDocument(
  //     document,
  //     lineStartToWord
  //   );
  //   definitionInformation.file = filePath;
  // } else
  if (
    PATTERNS.FUNCTION_DECLARATON.test(lineStartToWord) &&
    !PATTERNS.PARAMS_DECLARATION.test(word)
  ) {
    const sameModuleControllerSub = path.dirname(
        vscode.workspace
          .asRelativePath(document.fileName)
          .substring(REL_CONTROLLERS.length + 1)
      ),
      filePath = path.join(
        REL_VIEWS,
        sameModuleControllerSub,
        path.basename(document.fileName).replace(/_controller\.rb$/, ''),
        word + '.*'
      ),
      upperText = document.getText(
        new vscode.Range(new vscode.Position(0, 0), position)
      ),
      isPrivateMethod = /\s*private/.test(upperText);
    if (isPrivateMethod) {
      return Promise.resolve(null);
    }
    definitionInformation.file = filePath;
  } else if (PATTERNS.INCLUDE_DECLARATION.test(lineStartToWord)) {
    definitionInformation.file = getConcernsFilePath(
      lineStartToWord,
      FileType.ControllerConcerns
    );
    // } else if (PATTERNS.CAPITALIZED.test(word)) {
    //   //lib or model combination
    //   return getLibOrModelFilePath(lineStartToWord, word);
  } else if (PATTERNS.PARAMS_DECLARATION.test(word)) {
    const filePath = document.fileName,
      line = document
        .getText()
        .split('\n')
        .findIndex((line) =>
          new RegExp('^def\\s+' + word + SYMBOL_END).test(line.trim())
        );
    definitionInformation.file = filePath;
    definitionInformation.line = line;
  } else if (PATTERNS.LAYOUT_DECLARATION.test(lineStartToWord)) {
    const layoutPath = PATTERNS.LAYOUT_MATCH.exec(lineStartToWord)[2];
    definitionInformation.file = path.join(REL_LAYOUTS, layoutPath + '.*');
  } else if (
    PATTERNS.RENDER_DECLARATION.test(lineStartToWord) ||
    PATTERNS.RENDER_TO_STRING_DECLARATION.test(lineStartToWord)
  ) {
    definitionInformation.file = findViews(
      document,
      position,
      word,
      lineStartToWord
    );
  } else if (PATTERNS.CONTROLLER_FILTERS.test(lineStartToWord)) {
    const fileNameWithoutSuffix = path.parse(document.fileName).name,
      controllerName = inflection.camelize(fileNameWithoutSuffix);
    return findFunctionOrClassByClassName(
      document,
      position,
      word,
      controllerName
    );
  } else if (PATTERNS.HELPER_METHODS.test(lineStartToWord)) {
    // @todo find in app/helpers
    const fileNameWithoutSuffix = path.parse(document.fileName).name,
      controllerName = inflection.camelize(fileNameWithoutSuffix);
    return findFunctionOrClassByClassName(
      document,
      position,
      word,
      controllerName
    );
  } else {
    return findLocationByWord(document, position, word, lineStartToWord);
  }
  const promise = new Promise<RailsDefinitionInformation>(
    definitionResolver(document, definitionInformation)
  );
  return promise;
}

export function getSymbolPath(
  relpath: string,
  line: string,
  fileType: FileType
) {
  const [currentClassRaw, parentClassRaw] = line.split('<'),
    currentClass = currentClassRaw.trim(),
    parentClass = parentClassRaw.trim(),
    relPath = FileTypeRelPath.get(fileType);
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
    name = seq[seq.length - 1],
    filePath = path.join(relPath, sub, name + '.rb');
  return filePath;
}

export function getParentControllerFilePathByDocument(
  entryDocument: vscode.TextDocument,
  line: string
) {
  const relPath = vscode.workspace.asRelativePath(entryDocument.fileName),
    filePath = getSymbolPath(relPath, line, FileType.Controller);
  return filePath;
}

export async function getFunctionOrClassInfoInFile(
  fileAbsPath: string,
  reg
): Promise<[RailsDefinitionInformation, string]> {
  const definitionInformation: RailsDefinitionInformation = {
    file: null,
    line: 0,
    column: 0,
  };
  if (!fs.existsSync(fileAbsPath)) {
    return [definitionInformation, null];
  }
  const fileStream = fs.createReadStream(fileAbsPath);

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });
  let lineNumber = 0,
    classDeclaration,
    lineIndex = -1;
  for await (const lineText of rl) {
    if (PATTERNS.CLASS_INHERIT_DECLARATION.test(lineText)) {
      classDeclaration = lineText;
    }
    if (reg.test(lineText)) {
      lineIndex = lineNumber;
      definitionInformation.file = fileAbsPath;
      definitionInformation.line = lineIndex;
      definitionInformation.column = lineText.length;
      break;
    }
    lineNumber++;
  }

  return [definitionInformation, classDeclaration];
}

export async function findFunctionOrClassByClassNameInFile(
  fileAbsPath: string,
  reg
): Promise<RailsDefinitionInformation> {
  // @todo find in included moduels
  let [
      definitionInformation,
      classDeclaration,
    ] = await getFunctionOrClassInfoInFile(fileAbsPath, reg),
    lineIndex = definitionInformation.line;
  while (-1 === lineIndex) {
    const [, symbol] = classDeclaration.split('<'),
      parentController = symbol.trim(),
      filePath = getSymbolPath(
        vscode.workspace.asRelativePath(fileAbsPath),
        parentController,
        FileType.Controller
      ),
      fileAbsPath2 = path.join(vscode.workspace.rootPath, filePath);

    [
      definitionInformation,
      classDeclaration,
    ] = await getFunctionOrClassInfoInFile(fileAbsPath2, reg);
    lineIndex = definitionInformation.line;
  }
  if (-1 !== lineIndex) {
    return definitionInformation;
  }
}

export function findFunctionOrClassByClassName(
  entryDocument: vscode.TextDocument,
  position: vscode.Position,
  funcOrClass: string,
  clasName: string
): Promise<RailsDefinitionInformation> {
  const definitionInformation: RailsDefinitionInformation = {
      file: null,
      line: 0,
      column: 0,
    },
    lines = entryDocument.getText().split('\n'),
    regPrefix = PATTERNS.CAPITALIZED.test(funcOrClass)
      ? 'class\\s+'
      : 'def\\s+',
    reg = new RegExp(regPrefix + funcOrClass + '(?![A-Za-z0-9_])'),
    lineIndex = lines.findIndex((line) => reg.test(line.trim()));
  if (-1 !== lineIndex) {
    // same file
    definitionInformation.file = entryDocument.uri.fsPath;
    definitionInformation.line = lineIndex;
    definitionInformation.column = lines[lineIndex].length;
    return Promise.resolve(definitionInformation);
  } else {
    const beforeRange = new vscode.Range(new vscode.Position(0, 0), position),
      beforeText = entryDocument.getText(beforeRange),
      beforeLines = beforeText.split('\n');
    const line = beforeLines.find((line) =>
      new RegExp('^class\\s+.*' + clasName + SYMBOL_END).test(line.trim())
    );
    if (!line) {
      return Promise.reject('');
    }
    const filePath = getParentControllerFilePathByDocument(entryDocument, line),
      fileAbsPath = path.join(vscode.workspace.rootPath, filePath);
    return new Promise<RailsDefinitionInformation>((resolve, reject) => {
      const definitionInformation = findFunctionOrClassByClassNameInFile(
        fileAbsPath,
        reg
      );
      resolve(definitionInformation);
    });
  }
}

export function modelDefinitionLocation(
  document: vscode.TextDocument,
  position: vscode.Position,
  word: string,
  lineStartToWord: string
): Thenable<RailsDefinitionInformation> {
  const definitionInformation: RailsDefinitionInformation = {
    file: null,
    line: 0,
    column: 0,
  };
  const reg = new RegExp(
    '(^has_one|^has_many|^has_and_belongs_to_many|^belongs_to)\\s+:' + word
  );
  if (reg.test(lineStartToWord)) {
    const name = inflection.singularize(word);
    definitionInformation.file = path.join(REL_MODELS, '**', name + '.rb');
  } else if (PATTERNS.INCLUDE_DECLARATION.test(lineStartToWord)) {
    definitionInformation.file = getConcernsFilePath(
      lineStartToWord,
      FileType.ModelConcerns
    );
    // } else if (PATTERNS.CAPITALIZED.test(word)) {
    //   return getLibOrModelFilePath(lineStartToWord, word);
  } else if (
    PATTERNS.RENDER_DECLARATION.test(lineStartToWord) ||
    PATTERNS.RENDER_TO_STRING_DECLARATION.test(lineStartToWord)
  ) {
    definitionInformation.file = findViews(
      document,
      position,
      word,
      lineStartToWord
    );
  } else {
    // return findLocationByWord(document, position, word, lineStartToWord);
  }
  const promise = new Promise<RailsDefinitionInformation>(
    definitionResolver(document, definitionInformation)
  );

  return promise;
}

const FileTypeHandlers = new Map([
  [FileType.Controller, controllerDefinitionLocation],
  [FileType.Helper, controllerDefinitionLocation],
  [FileType.Model, modelDefinitionLocation],
  // [FileType.Unkown, findLocationByWord]
]);

export function definitionResolver(
  document,
  definitionInformation,
  exclude = null,
  maxNum = null
) {
  return (resolve, reject) => {
    const findPath = path.isAbsolute(definitionInformation.file)
      ? vscode.workspace.asRelativePath(definitionInformation.file)
      : definitionInformation.file;
    vscode.workspace.findFiles(findPath).then(
      (uris: vscode.Uri[]) => {
        if (!uris.length) {
          reject(missingFilelMsg + definitionInformation.file);
        } else if (uris.length === 1) {
          definitionInformation.file = uris[0].fsPath;
          resolve(definitionInformation);
        } else {
          const relativeFileName = vscode.workspace.asRelativePath(
              document.fileName
            ),
            rh = new RailsHelper(relativeFileName, null);
          rh.showQuickPick(
            uris.map((uri) => vscode.workspace.asRelativePath(uri.path))
          );
          resolve(null);
        }
      },
      () => {
        reject(missingFilelMsg + definitionInformation.file);
      }
    );
  };
}

export function definitionLocation(
  document: vscode.TextDocument,
  position: vscode.Position,
  goConfig?: vscode.WorkspaceConfiguration,
  token?: vscode.CancellationToken
): Thenable<RailsDefinitionInformation> {
  //   let context: vscode.ExtensionContext = this;
  const wordRange = document.getWordRangeAtPosition(position);
  const lineText = document.lineAt(position.line).text.trim();
  const lineStartToWord = document
    .getText(
      new vscode.Range(new vscode.Position(position.line, 0), wordRange.end)
    )
    .trim();
  const word = document.getText(wordRange);
  //   context.logger.debug(word);
  if (lineText.startsWith('//') || word.match(/^\d+.?\d+$/)) {
    return Promise.resolve(null);
  }
  if (!goConfig) {
    goConfig = vscode.workspace.getConfiguration('rails');
  }
  const symbol = new RegExp('(((::)?[A-Za-z]+)*(::)?' + word + ')').exec(
    lineStartToWord
  )[1];
  if (RAILS.has(symbol) || RUBY.has(symbol)) {
    // context.logger.debug("rails symbols")
    return Promise.resolve(null);
  }
  const fileType = dectFileType(document.fileName);
  if (FileType.Unkown === fileType) {
    return Promise.resolve(null);
  }
  // let exclude;
  const handle = FileTypeHandlers.get(fileType);
  if (!handle) {
    return Promise.resolve(null);
  }
  return handle(document, position, word, lineStartToWord);
}

export class RailsDefinitionProvider implements vscode.DefinitionProvider {
  private goConfig = null;
  //   private context: vscode.ExtensionContext;
  constructor(
    // context: vscode.ExtensionContext,
    goConfig?: vscode.WorkspaceConfiguration
  ) {
    this.goConfig = goConfig;
    // this.context = context;
  }

  public provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Thenable<vscode.Location> {
    return definitionLocation(document, position, this.goConfig, token).then(
      (definitionInfo) => {
        if (definitionInfo === null || definitionInfo.file === null)
          return null;
        const definitionResource = vscode.Uri.file(definitionInfo.file);
        const pos = new vscode.Position(
          definitionInfo.line,
          definitionInfo.column || 0 // required here otherwise raise "Invalid arguments"
        );
        return new vscode.Location(definitionResource, pos);
      },
      (err) => {
        if (err) {
          // Prompt for missing tool is located here so that the
          // prompts dont show up on hover or signature help
          if (typeof err === 'string' && err.startsWith(missingFilelMsg)) {
            // promptForMissingTool(err.substr(missingToolMsg.length));
          } else {
            return Promise.reject(err);
          }
        }
        return Promise.resolve(null);
      }
    );
  }
}
