"use strict";

import vscode = require("vscode");
import path = require("path");
import fs = require("fs");
import { dectFileType } from "../src/utils";
import { RailsHelper } from "../src/rails_helper";
import {
  FileType,
  FileTypeRelPath,
  REL_CONTROLLERS,
  REL_CONTROLLERS_CONCERNS,
  REL_MODELS,
  REL_MODELS_CONCERNS,
  REL_VIEWS,
  REL_LAYOUTS,
  REL_HELPERS,
  REL_JAVASCRIPTS,
  REL_STYLESHEETS,
  PATTERNS,
  VIEWS_PATTERNS
} from "../src/constants";
import { RailsDefinitionInformation } from "./interfaces";
import { RAILS } from "./rails";
import inflection = require("inflection");
import lineByLine = require("n-readlines");

const missingFilelMsg = "Missing file: ";
const couldNotOpenMsg = "Could Not Open file: ";
const SYMBOL_END = "[^\\w]";

export function findViews(
  document: vscode.TextDocument,
  position: vscode.Position,
  _path: string,
  fileType: string = "",
  viewType: string = "partial" // partial or template
) {
  let filePath,
    isSameDirPartial = /^[a-zA-Z0-9_-]+$/.test(_path),
    isViewsRelativePath = _path.indexOf("/") !== -1,
    ext = path.parse(_path).ext,
    _underscore = viewType == "partial" ? "_" : "",
    definitionInformation: RailsDefinitionInformation = {
      file: null,
      line: 0
    };

  if (isSameDirPartial) {
    let fileName = vscode.workspace.asRelativePath(document.fileName),
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
    return Promise.resolve(null);
  }
  console.log(filePath, isViewsRelativePath, isSameDirPartial);
  let promise = new Promise<RailsDefinitionInformation>(
    definitionResolver(document, definitionInformation)
  );
  return promise;
}

var FileTypeHandlers = new Map([
  [FileType.View, findViews]
  // [FileType.Model, modelDefinitionLocation],
  // [FileType.Unkown, findLocationByWord]
]);

export function definitionResolver(
  document,
  definitionInformation,
  exclude = null,
  maxNum = null
) {
  return (resolve, reject) => {
    vscode.workspace
      .findFiles(vscode.workspace.asRelativePath(definitionInformation.file))
      .then(
        (uris: vscode.Uri[]) => {
          console.log(uris);
          if (!uris.length) {
            reject(missingFilelMsg + definitionInformation.file);
          } else if (uris.length == 1) {
            definitionInformation.file = uris[0].fsPath;
            resolve(definitionInformation);
          } else {
            // let relativeFileName = vscode.workspace.asRelativePath(
            //     document.fileName
            //   ),
            //   rh = new RailsHelper(relativeFileName, null);
            // rh.showQuickPick(
            //   uris.map(uri => vscode.workspace.asRelativePath(uri.path))
            // );
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
  let wordRange = document.getWordRangeAtPosition(
    position,
    /([A-Za-z\/0-9_-]+)(\.[A-Za-z0-9]+)*/
  );
  let lineText = document.lineAt(position.line).text.trim();
  let lineStartToWord = document
    .getText(
      new vscode.Range(new vscode.Position(position.line, 0), wordRange.end)
    )
    .trim();
  let lineStartToWordStart = document
    .getText(
      new vscode.Range(new vscode.Position(position.line, 0), wordRange.start)
    )
    .trim();
  let matched = lineStartToWordStart.match(PATTERNS.RENDER_MATCH),
    preWord = matched && matched[matched.length - 1],
    viewType = preWord && !preWord.includes("render") ? preWord : "partial";
  console.log(`viewType:${viewType}`);
  let word = document.getText(wordRange);
  console.log(word);
  // if (lineText.startsWith("/") || word.match(/^\d+.?\d+$/)) {
  //   return Promise.resolve(null);
  // }
  if (!goConfig) {
    goConfig = vscode.workspace.getConfiguration("rails");
  }
  let symbol = new RegExp("(((::)?[A-Za-z]+)*(::)?" + word + ")").exec(
    lineStartToWord
  )[1];
  if (RAILS.has(symbol)) {
    console.log("rails symbols");
    return Promise.resolve(null);
  }
  let renderMatched = lineText.match(VIEWS_PATTERNS.RENDER_PATTERN);
  if (renderMatched) {
    console.log(renderMatched);
    return findViews(document, position, word, "", viewType);
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
      definitionInfo => {
        if (definitionInfo == null || definitionInfo.file == null) return null;
        let definitionResource = vscode.Uri.file(definitionInfo.file);
        let pos = new vscode.Position(
          definitionInfo.line,
          definitionInfo.column
        );
        return new vscode.Location(definitionResource, pos);
      },
      err => {
        if (err) {
          // Prompt for missing tool is located here so that the
          // prompts dont show up on hover or signature help
          if (typeof err === "string" && err.startsWith(missingFilelMsg)) {
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
