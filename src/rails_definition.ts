'use strict';

import vscode from 'vscode';
import path from 'path';
import fs from 'fs';
import {
  dectFileType,
  findFiles,
  getSubPathBySymbol,
  wordsToPath,
} from './utils';
import { RailsHelper } from './rails_helper';
import { PATTERNS } from './constants';
import { RAILS } from './symbols/rails';
import { RUBY } from './symbols/ruby';
import inflection from 'inflection2';
import readline from 'readline';
import { RailsDefinitionInformation } from './interfaces';
import { promisify } from 'util';
import { getConcernsFilePath, getSymbolPath } from './rails/path';
import { FileType } from './rails/file';
import { Rails } from './rails';

const missingFilelMsg = 'Missing file: ';
const couldNotOpenMsg = 'Could Not Open file: ';
const SYMBOL_END = '[^\\w]';

export function findClassInDocumentCallback(
  name: string,
  document: vscode.TextDocument
): Promise<RailsDefinitionInformation> {
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
  console.log('findClassInDocumentCallback name', name);
  console.log('findClassInDocumentCallback document', document);
  return Promise.resolve(definitionInformation);
}

export async function getLibFilePath(
  document: vscode.TextDocument,
  demodulized: string,
  name: string,
  sub: string
): Promise<RailsDefinitionInformation> {
  const root = vscode.workspace.getWorkspaceFolder(document.uri).uri.fsPath;

  const filePathInLib = name ? path.join('lib', sub, name + '.rb') : '',
    libPath = sub ? path.join(root, 'lib', sub + '.rb') : '',
    funcOrClass =
      demodulized.indexOf('.') !== -1 ? demodulized.split('.')[1] : demodulized,
    regPrefix = PATTERNS.CAPITALIZED.test(funcOrClass)
      ? 'class\\s+'
      : 'def\\s+',
    reg = new RegExp(regPrefix + funcOrClass + SYMBOL_END);
  console.log(
    `name:${name} demodulized:${demodulized} funcOrClass:${funcOrClass}`
  );
  let findInLibUris: vscode.Uri[] = [];
  let findInLib: RailsDefinitionInformation = null;
  try {
    findInLibUris = await findFiles(document, filePathInLib, null, 1);
    // tslint:disable-next-line: no-empty
  } catch (e) {}

  if (filePathInLib) {
    if (findInLibUris.length > 0) {
      try {
        findInLib = await vscode.workspace
          .openTextDocument(findInLibUris[0])
          .then(findClassInDocumentCallback.bind(null, demodulized), () => {
            return Promise.reject(couldNotOpenMsg + filePathInLib);
          });
      } catch (e) {
        return Promise.reject(couldNotOpenMsg + filePathInLib);
      }
    } else {
      if (libPath) {
        try {
          findInLib = await findFunctionOrClassByClassNameInFile(libPath, reg);
          // tslint:disable-next-line: no-empty
        } catch (e) {}
      }
    }
  }

  if (findInLib) {
    return findInLib;
  } else {
    return Promise.reject();
  }
}

export async function getModelFilePath(
  document: vscode.TextDocument,
  demodulized: string,
  name: string,
  sub: string
): Promise<RailsDefinitionInformation> {
  const filePathInModels = path.join(Rails.Models, '**', sub, name + '.rb');
  let uris: vscode.Uri[];
  try {
    uris = await findFiles(document, filePathInModels, null, 1);
  } catch (e) {}
  if (!uris.length) {
    return Promise.reject();
  }
  return vscode.workspace
    .openTextDocument(uris[0])
    .then(findClassInDocumentCallback.bind(null, demodulized), () => {
      return Promise.reject(couldNotOpenMsg + filePathInModels);
    });
}
export async function getLibOrModelFilePath(
  document: vscode.TextDocument,
  lineStartToWord: string,
  word: string
): Promise<RailsDefinitionInformation> {
  console.log(`getLibOrModelFilePath`, arguments);
  const symbol = new RegExp('(((::)?[A-Za-z]+)*(::)?' + word + ')').exec(
    lineStartToWord
  )[1];
  console.log(`symbol:${symbol}`);
  const [name, sub] = getSubPathBySymbol(symbol),
    demodulized = inflection.demodulize(symbol);
  let result = null;
  try {
    result = await getLibFilePath(document, demodulized, name, sub);
  } catch (e) {}
  if (result) {
    return result;
  }

  try {
    result = await getModelFilePath(document, demodulized, name, sub);
  } catch (e) {}
  if (result) {
    return result;
  }
  if (!result) {
    return Promise.reject();
  }
}

export async function findLocationByWord(
  document: vscode.TextDocument,
  position: vscode.Position,
  word: string,
  lineStartToWord: string
) {
  console.log(`findLocationByWord`, arguments);
  if (PATTERNS.CAPITALIZED.test(word)) {
    return getLibOrModelFilePath(document, lineStartToWord, word);
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
  console.log(`findViews`, arguments);
  let filePath: string;
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
            .substring(Rails.Controllers.length + 1)
            .replace('_controller.rb', '');
  if (preWord === 'layout') {
    filePath = path.join(Rails.Layouts, viewPath);
  } else {
    filePath = path.join(Rails.Views, sub, viewPath);
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
  console.log(
    `controllerDefinitionLocation`,
    JSON.stringify(position),
    word,
    lineStartToWord
  );
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
          .substring(Rails.Controllers.length + 1)
      ),
      filePath = path.join(
        Rails.Views,
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
      Rails.FileType.ControllerConcerns
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
    definitionInformation.file = path.join(Rails.Layouts, layoutPath + '.*');
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

/**
 *
 * @param entryDocument
 * @param line
 * @return parent controller relative path
 */
export async function getParentControllerFilePathByDocument(
  entryDocument: vscode.TextDocument,
  line: string
): Promise<string> {
  console.log(`getParentControllerFilePathByDocument`, arguments);
  const relPath = vscode.workspace.asRelativePath(entryDocument.fileName),
    filePath = getSymbolPath(relPath, line, FileType.Controller);
  console.log(`getParentControllerFilePathByDocument returns`, filePath);
  return findFiles(entryDocument, filePath, null, 1).then((uris) => {
    if (uris.length !== 0) {
      return filePath;
    } else {
      return '';
    }
  });
}

export async function getFunctionOrClassInfoInFile(
  fileAbsPath: string,
  reg: RegExp
): Promise<[RailsDefinitionInformation, string]> {
  console.log(`getFunctionOrClassInfoInFile`, fileAbsPath, reg.toString());
  const definitionInformation: RailsDefinitionInformation = {
    file: null,
    line: -1,
    column: 0,
  };
  const exists = promisify(fs.exists);
  const existed = await exists(path.normalize(fileAbsPath));
  if (!existed) {
    return Promise.reject();
  }

  const fileStream = fs.createReadStream(path.normalize(fileAbsPath));

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });
  let lineNumber = 0,
    classDeclaration: string,
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
  console.log(
    `getFunctionOrClassInfoInFile return`,
    JSON.stringify(definitionInformation),
    classDeclaration
  );
  if (!definitionInformation.file) {
    return Promise.reject();
  }
  return [definitionInformation, classDeclaration];
}

export async function findFunctionOrClassByClassNameInFile(
  fileAbsPath: string,
  reg: RegExp
): Promise<RailsDefinitionInformation> {
  const root = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(fileAbsPath))
    .uri.fsPath;
  console.log(
    `findFunctionOrClassByClassNameInFile`,
    fileAbsPath,
    reg.toString()
  );
  // @todo find in included moduels
  let definitionInformation: RailsDefinitionInformation,
    classDeclaration: string;
  try {
    [
      definitionInformation,
      classDeclaration,
    ] = await getFunctionOrClassInfoInFile(fileAbsPath, reg);
  } catch (e) {
    return Promise.reject();
  }

  let lineIndex = definitionInformation.line;
  while (-1 === lineIndex) {
    const [, symbol] = classDeclaration.split('<');
    console.log('findFunctionOrClassByClassNameInFile symbol', symbol);
    const parentController = symbol.trim();
    const filePath = getSymbolPath(
      vscode.workspace.asRelativePath(fileAbsPath),
      parentController,
      FileType.Controller
    );
    const fileAbsPath2 = path.join(root, filePath);
    try {
      [
        definitionInformation,
        classDeclaration,
      ] = await getFunctionOrClassInfoInFile(fileAbsPath2, reg);
    } catch (e) {
      return Promise.reject();
    }

    lineIndex = definitionInformation.line;
  }
  if (-1 !== lineIndex) {
    console.log(
      'findFunctionOrClassByClassNameInFile return',
      JSON.stringify(definitionInformation)
    );
    return definitionInformation;
  } else {
    return Promise.reject();
  }
}

export async function findFunctionOrClassByClassName(
  entryDocument: vscode.TextDocument,
  position: vscode.Position,
  funcOrClass: string,
  clasName: string
): Promise<RailsDefinitionInformation> {
  console.log(`findFunctionOrClassByClassName`, arguments);
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

    const filePath = await getParentControllerFilePathByDocument(
      entryDocument,
      line
    );
    console.log('filePath', filePath);
    if (!filePath) {
      return Promise.reject();
    }
    const root = vscode.workspace.getWorkspaceFolder(entryDocument.uri).uri
      .path;
    const fileAbsPath = vscode.Uri.file(path.join(root, filePath)).path;
    return findFunctionOrClassByClassNameInFile(fileAbsPath, reg);
  }
}

export function modelDefinitionLocation(
  document: vscode.TextDocument,
  position: vscode.Position,
  word: string,
  lineStartToWord: string
): Thenable<RailsDefinitionInformation> {
  console.log(
    `modelDefinitionLocation`,
    JSON.stringify(position),
    word,
    lineStartToWord
  );
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
    definitionInformation.file = path.join(Rails.Models, '**', name + '.rb');
  } else if (PATTERNS.INCLUDE_DECLARATION.test(lineStartToWord)) {
    definitionInformation.file = getConcernsFilePath(
      lineStartToWord,
      FileType.ModelConcerns
    );
  } else if (PATTERNS.CAPITALIZED.test(word)) {
    return getLibOrModelFilePath(document, lineStartToWord, word);
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
    return findLocationByWord(document, position, word, lineStartToWord);
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
  document: vscode.TextDocument,
  definitionInformation: RailsDefinitionInformation,
  exclude: vscode.GlobPattern = null,
  maxNum: number = null
) {
  return (resolve: (a: any) => void, reject: (reason?: any) => void) => {
    const findPath = path.isAbsolute(definitionInformation.file)
      ? vscode.workspace.asRelativePath(definitionInformation.file)
      : definitionInformation.file;
    findFiles(document, findPath).then(
      (uris: vscode.Uri[]) => {
        if (!uris.length) {
          return reject(missingFilelMsg + definitionInformation.file);
        } else if (uris.length === 1) {
          definitionInformation.file = uris[0].fsPath;
          return resolve(definitionInformation);
        } else {
          const relativeFileName = vscode.workspace.asRelativePath(
              document.fileName
            ),
            rh = new RailsHelper(document, relativeFileName, null);
          rh.showQuickPick(
            uris.map((uri) => vscode.workspace.asRelativePath(uri))
          );
          return resolve(null);
        }
      },
      () => {
        return reject(missingFilelMsg + definitionInformation.file);
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
  console.log('definitionLocation', arguments);
  // let context: vscode.ExtensionContext = this;
  if (position.line < 0) {
    return Promise.resolve(null);
  }
  const wordRange = document.getWordRangeAtPosition(position);
  if (!wordRange) {
    return Promise.resolve(null);
  }
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
  if (
    RAILS.prefix(symbol.toLowerCase()).isProper ||
    RUBY.prefix(symbol.toLowerCase()).isProper
  ) {
    console.log('rails symbols:' + symbol);
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
  private goConfig: vscode.WorkspaceConfiguration = null;
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
  ) {
    return definitionLocation(document, position, this.goConfig, token).then(
      (definitionInfo) => {
        if (definitionInfo === null || definitionInfo.file === null)
          return null;
        if (definitionInfo.line < 0) {
          return null;
        }
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
