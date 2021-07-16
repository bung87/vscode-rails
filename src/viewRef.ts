'use strict';

import * as vscode from 'vscode';
import * as path from 'path';

import {
  // FileType,
  // FileTypeRelPath,
  // REL_CONTROLLERS,
  // REL_CONTROLLERS_CONCERNS,
  // REL_MODELS,
  // REL_MODELS_CONCERNS,
  REL_VIEWS,
  // REL_LAYOUTS,
  // REL_HELPERS,
  // REL_JAVASCRIPTS,
  // REL_STYLESHEETS,
  PATTERNS,
  VIEWS_PATTERNS,
} from './constants';
import { RailsDefinitionInformation } from './interfaces';
import { RAILS } from './symbols/rails';
import { findFiles } from './utils';

const missingFilelMsg = 'Missing file: ';
// const couldNotOpenMsg = 'Could Not Open file: ';
// const SYMBOL_END = '[^\\w]';
const NO_DEFINITION = 'No definition found!';

/**
 * narrow view finding path
 * @param _path parts after app/views
 * @param fileType
 * @param viewType
 * @returns promised view glob path
 */
export function findViews(
  document: vscode.TextDocument,
  position: vscode.Position,
  _path: string,
  fileType: string = '',
  viewType: string = 'partial' // partial or template
) {
  console.log(`findViews`, arguments);
  let filePath;
  const isSameDirPartial = /^[a-zA-Z0-9_-]+$/.test(_path),
    isViewsRelativePath = _path.indexOf('/') !== -1,
    ext = path.parse(_path).ext,
    _underscore = viewType.endsWith('partial') ? '_' : '', // viewType could be "json.partial"
    definitionInformation: RailsDefinitionInformation = {
      file: null,
      line: 0,
      column: 0,
    };

  if (isSameDirPartial) {
    const fileName = vscode.workspace.asRelativePath(document.fileName),
      dir = path.dirname(fileName);
    filePath = path.join(dir, `${_underscore}${_path}${fileType}.*`);
    definitionInformation.file = filePath;
  } else if (ext) {
    filePath = path.join(REL_VIEWS, _path);
    definitionInformation.file = filePath;
  } else if (isViewsRelativePath) {
    filePath = path.join(
      REL_VIEWS,
      path.dirname(_path),
      `${_underscore}${path.basename(_path)}${fileType}.*`
    );
    definitionInformation.file = filePath;
  } else {
    return Promise.reject('not a view');
  }
  console.log(viewType, filePath, isViewsRelativePath, isSameDirPartial);
  const promise = new Promise<RailsDefinitionInformation>(
    definitionResolver(document, definitionInformation)
  );
  return promise;
}

/**
 *
 * @returns Promise callback resolved glob path(exact path)
 */
export function definitionResolver(
  document: vscode.TextDocument,
  definitionInformation: RailsDefinitionInformation,
  exclude: vscode.GlobPattern = null,
  maxNum: number = null
) {
  console.log(`definitionResolver`, arguments);
  return (resolve, reject) => {
    findFiles(
      document,
      vscode.workspace.asRelativePath(definitionInformation.file)
    ).then(
      (uris: vscode.Uri[]) => {
        if (!uris.length) {
          reject(missingFilelMsg + definitionInformation.file);
        } else if (uris.length === 1) {
          definitionInformation.file = uris[0].fsPath;
          resolve(definitionInformation);
        } else {
          reject(NO_DEFINITION);
        }
      },
      () => {
        reject(missingFilelMsg + definitionInformation.file);
      }
    );
  };
}
/**
 * interaction with provideDefinition
 * @returns Thenable<RailsDefinitionInformation>
 */
export function definitionLocation(
  document: vscode.TextDocument,
  position: vscode.Position,
  goConfig?: vscode.WorkspaceConfiguration,
  token?: vscode.CancellationToken
): Thenable<RailsDefinitionInformation> {
  console.log(`definitionLocation`, arguments);
  const wordRange = document.getWordRangeAtPosition(
    position,
    /([A-Za-z\/0-9_-]+)(\.[A-Za-z0-9]+)*/
  );
  if (!wordRange) {
    return Promise.resolve(null);
  }
  const lineText = document.lineAt(position.line).text.trim();
  const lineStartToWord = document
    .getText(
      new vscode.Range(new vscode.Position(position.line, 0), wordRange.end)
    )
    .trim();
  const lineStartToWordStart = document
    .getText(
      new vscode.Range(new vscode.Position(position.line, 0), wordRange.start)
    )
    .trim();
  const matched = lineStartToWordStart.match(PATTERNS.RENDER_MATCH),
    preWord = matched && matched[matched.length - 1],
    viewType = preWord && !preWord.includes('render') ? preWord : 'partial';
  console.log(`viewType:${viewType}`);
  const word = document.getText(wordRange);
  console.log(word);
  // if (lineText.startsWith("/") || word.match(/^\d+.?\d+$/)) {
  //   return Promise.resolve(null);
  // }
  if (!goConfig) {
    goConfig = vscode.workspace.getConfiguration('rails');
  }
  const symbol = new RegExp('(((::)?[A-Za-z]+)*(::)?' + word + ')').exec(
    lineStartToWord
  )[1];
  if (RAILS.hasWord(symbol.toLowerCase())) {
    return Promise.reject('Rails symbols');
  }
  const renderMatched = lineText.match(VIEWS_PATTERNS.RENDER_PATTERN);
  if (renderMatched) {
    console.log(renderMatched);
    return findViews(document, position, word, '', viewType);
  } else {
    return findViews(document, position, word, '', viewType);
  }
}

export class ViewDefinitionProvider implements vscode.DefinitionProvider {
  private goConfig = null;

  constructor(goConfig?: vscode.WorkspaceConfiguration) {
    this.goConfig = goConfig;
  }

  public provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Thenable<vscode.Location> {
    return definitionLocation(document, position, this.goConfig, token).then(
      (definitionInfo) => {
        if (definitionInfo === null || definitionInfo.file === null) {
          return null;
        }
        const definitionResource = vscode.Uri.file(definitionInfo.file);
        const pos = new vscode.Position(
          definitionInfo.line,
          definitionInfo.column || 0 // required here otherwise rais "Invalid arguments."
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
            return Promise.reject(NO_DEFINITION);
          }
        }
        return Promise.reject(NO_DEFINITION);
      }
    );
  }
}
