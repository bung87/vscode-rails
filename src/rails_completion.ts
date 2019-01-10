"use strict";

import vscode = require("vscode");
import path = require("path");
import { isPositionInString, dectFileType } from "./utils";
import { definitionLocation } from "./railsDeclaration";
import minimatch = require("minimatch");

import {
  FileType,
  PATTERNS,
  REL_CONTROLLERS,
  REL_MODELS,
  REL_VIEWS,
  REL_LAYOUTS,
  REL_HELPERS,
  REL_JAVASCRIPTS,
  REL_STYLESHEETS
} from "./constants";
import lineByLine = require("n-readlines");
import { RailsHelper } from "./rails_helper";

export enum TriggerCharacter {
  dot,
  quote,
  colon
}

export function modelQueryInterface(): vscode.CompletionItem[] {
  var suggestions: vscode.CompletionItem[] = [];
  let query_methods = [
    "find_by",
    "first",
    "last",
    "take",
    "find",
    "find_each",
    "find_in_batches",
    "create_with",
    "distinct",
    "eager_load",
    "extending",
    "from",
    "group",
    "having",
    "includes",
    "joins",
    "left_outer_joins",
    "limit",
    "lock",
    "none",
    "offset",
    "order",
    "preload",
    "readonly",
    "references",
    "reorder",
    "reverse_order",
    "select",
    "where",
    "all"
  ];
  query_methods.forEach(value => {
    let item = new vscode.CompletionItem(value);
    item.insertText = value;
    item.kind = vscode.CompletionItemKind.Method;
    suggestions.push(item);
  });
  return suggestions;
}
function getCols(
  fileAbsPath,
  position: vscode.Position,
  triggerCharacter: TriggerCharacter,
  prefix?: string
): vscode.CompletionItem[] {
  var liner = new lineByLine(fileAbsPath),
    cols = [],
    line,
    lineNumber = 0,
    lineIndex = -1;
  while ((line = liner.next())) {
    let lineText = line.toString("utf8").trim();

    if (/^#\s+([a-z0-9_]+)/.test(lineText)) {
      let col = /^#\s+([a-z0-9_]+)/.exec(lineText)[1];
      let name = prefix ? prefix + col : col;
      let item = new vscode.CompletionItem(name);
      item.insertText = name;
      item.kind = vscode.CompletionItemKind.Field;
      // @todo? move cusor next to quote eg. Client.where('locked' => true) :id=>
      cols.push(item);
    }
    lineNumber++;
  }
  return cols;
}
function getMethods(fileAbsPath): vscode.CompletionItem[] {
  var liner = new lineByLine(fileAbsPath),
    methods = [],
    line,
    lineNumber = 0,
    markAsStart = false,
    markAsEnd = false,
    lineIndex = -1;
  while ((line = liner.next())) {
    let lineText = line.toString("utf8").trim();
    if (/^class\s+<<\s+self/.test(lineText)) {
      markAsStart = true;
      markAsEnd = false;
    }
    if (/^private$/.test(lineText)) {
      markAsEnd = true;
    }
    if (markAsEnd) continue;
    if (markAsStart && PATTERNS.FUNCTION_DECLARATON.test(lineText)) {
      let func = lineText.replace(PATTERNS.FUNCTION_DECLARATON, "");
      let item = new vscode.CompletionItem(func);
      item.insertText = func;
      item.kind = vscode.CompletionItemKind.Method;
      methods.push(item);
    }
    lineNumber++;
  }
  return methods;
}

export class RailsCompletionItemProvider
  implements vscode.CompletionItemProvider {
  private pkgsList = new Map<string, string>();

  public provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Thenable<vscode.CompletionItem[]> {
    return this.provideCompletionItemsInternal(
      document,
      position,
      token,
      vscode.workspace.getConfiguration("rails", document.uri)
    );
  }

  public provideCompletionItemsInternal(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    config: vscode.WorkspaceConfiguration
  ): Promise<vscode.CompletionItem[]> {
    return new Promise<vscode.CompletionItem[]>(async (resolve, reject) => {
      var suggestions: vscode.CompletionItem[] = [];
      let filename = document.fileName;
      let lineText = document.lineAt(position.line).text;
      let lineTillCurrentPosition = lineText.substr(0, position.character);
      console.log(`lineTillCurrentPosition:${lineTillCurrentPosition}`);
      let character =
        lineTillCurrentPosition[lineTillCurrentPosition.length - 1];
      // let autocompleteUnimportedPackages = config['autocompleteUnimportedPackages'] === true && !lineText.match(/^(\s)*(import|package)(\s)+/);
      if (lineText.match(/^\s*\/\//)) {
        return resolve([]);
      }
      var triggerCharacter: TriggerCharacter;
      switch (character) {
        case ".":
          triggerCharacter = TriggerCharacter.dot;
          break;
        case '"':
        case "'":
          triggerCharacter = TriggerCharacter.quote;
          break;
        case ":":
          triggerCharacter = TriggerCharacter.colon;
      }
      console.log(`triggerCharacter:${triggerCharacter}`);
      // let inString = isPositionInString(document, position);
      // if (!inString && lineTillCurrentPosition.endsWith('\"')) {
      //     return resolve([]);
      // }

      // get current word
      let position2 = new vscode.Position(
        position.line,
        position.character - 1
      );
      if ( triggerCharacter === TriggerCharacter.dot && PATTERNS.CLASS_STATIC_METHOD_CALL.test(lineTillCurrentPosition)) {
        let [, id, model] = PATTERNS.CLASS_STATIC_METHOD_CALL.exec(
          lineTillCurrentPosition
        );
        position2 = new vscode.Position(position.line, lineText.indexOf(id));
      }
      let wordAtPosition = document.getWordRangeAtPosition(position2);
      if(!wordAtPosition){
        return resolve(null);
      }
      let word = document.getText(wordAtPosition);
      let currentWord = "";
      if (
        wordAtPosition &&
        wordAtPosition.start.character < position.character
      ) {
        currentWord = word.substr(
          0,
          position.character - wordAtPosition.start.character
        );
      }
      if (currentWord.match(/^\d+$/)) {
        return resolve([]);
      }
      console.log(wordAtPosition,currentWord,character);
      if (triggerCharacter == TriggerCharacter.dot) {
        let info, fileType;
        try {
          info = await definitionLocation(document, position2);
          fileType = dectFileType(info.file);
        } catch (e) {
          console.error(e);
          reject(e);
        }
        switch (fileType) {
          case FileType.Model: // model static methods
            suggestions.push(...modelQueryInterface());
            let methods = getMethods(info.file);
            suggestions.push(...methods);
            let cols = getCols(
              info.file,
              position,
              triggerCharacter,
              "find_by_"
            );
            suggestions.push(...cols);
            break;
        }
      } else if (
        triggerCharacter == TriggerCharacter.colon ||
        triggerCharacter == TriggerCharacter.quote
      ) {
        if (PATTERNS.CLASS_STATIC_METHOD_CALL.test(lineTillCurrentPosition)) {
          let [, id, model] = PATTERNS.CLASS_STATIC_METHOD_CALL.exec(
            lineTillCurrentPosition
          );
          let position2 = new vscode.Position(
            position.line,
            lineText.indexOf(id)
          );
          let info, fileType;
          try {
            info = await definitionLocation(document, position2);
            fileType = dectFileType(info.file);
          } catch (e) {
            console.error(e);
            reject(e);
          }
          switch (fileType) {
            case FileType.Model: // model field suggestion
              let cols = getCols(info.file, position, triggerCharacter);
              suggestions.push(...cols);
              break;
          }
        } else if (
          PATTERNS.RENDER_DECLARATION.test(lineTillCurrentPosition.trim()) ||
          PATTERNS.RENDER_TO_STRING_DECLARATION.test(
            lineTillCurrentPosition.trim()
          ) ||
          PATTERNS.LAYOUT_DECLARATION.test(lineTillCurrentPosition.trim())
        ) {
          let matches = lineTillCurrentPosition.match(/([a-z]+)/g),
            id = matches.pop();
          console.log("render type:" + id);
          switch (id) {
            case "partial": // @todo if it is not controller related partial
              var relativeFileName = vscode.workspace.asRelativePath(
                  document.fileName
                ),
                rh = new RailsHelper(relativeFileName, null);
              var paths = rh.searchPaths().filter((v: string) => {
                return (
                  v.startsWith(REL_LAYOUTS) === false &&
                  v.startsWith(REL_VIEWS) === true
                );
              });
              console.log(`paths:${paths}`);
              var items = await rh.generateList(paths).then(list => {
                let partials = list
                  .map(v => path.parse(v).name.split(".")[0])
                  .filter(v => {
                    return v.startsWith("_");
                  });
                console.log(`partials:${partials}`);
                let items = partials.map((v: string) => {
                  let name = v.substring(1);
                  let item = new vscode.CompletionItem(name);
                  item.insertText =
                    triggerCharacter == TriggerCharacter.colon
                      ? " '" + name + "'"
                      : name;
                  item.kind = vscode.CompletionItemKind.File;
                  return item;
                });
                return items;
              });
              suggestions.push(...items);
              break;
            case "template": // @todo if it is base application controller or helper suggest all views
              var relativeFileName = vscode.workspace.asRelativePath(
                  document.fileName
                ),
                rh = new RailsHelper(relativeFileName, null);
              var paths = rh.searchPaths().filter((v: string) => {
                return (
                  v.startsWith(REL_LAYOUTS) === false &&
                  v.startsWith(REL_VIEWS) === true
                );
              });

              var items = await rh.generateList(paths).then(list => {
                let templates = list
                  .map(v =>
                    path.basename(
                      v.substring(REL_VIEWS.length + 1).split(".")[0]
                    )
                  )
                  .filter(v => {
                    return path.basename(v).startsWith("_") === false;
                  });
                let items = templates.map((v: string) => {
                  let name = v;
                  let item = new vscode.CompletionItem(name);
                  item.insertText =
                    triggerCharacter == TriggerCharacter.colon
                      ? " '" + name + "'"
                      : name;
                  item.kind = vscode.CompletionItemKind.File;
                  return item;
                });
                return items;
              });
              suggestions.push(...items);
              if (TriggerCharacter.quote == triggerCharacter) {
                var views = await vscode.workspace
                  .findFiles(path.join(REL_VIEWS, "**"), REL_LAYOUTS)
                  .then(res => {
                    return res
                      .filter(v => {
                        let p = vscode.workspace.asRelativePath(v);
                        return (
                          paths.some(v2 => {
                            return !minimatch(p, v2);
                          }) || path.basename(p).startsWith("_")
                        );
                      })
                      .map(i => {
                        let name = vscode.workspace
                            .asRelativePath(i)
                            .substring(REL_VIEWS.length + 1)
                            .split(".")[0],
                          item = new vscode.CompletionItem(name);
                        item.insertText =
                          triggerCharacter == TriggerCharacter.colon
                            ? " '" + name + "'"
                            : name;
                        item.kind = vscode.CompletionItemKind.File;
                        return item;
                      });
                  });
                suggestions.push(...views);
              }
              break;
            case "layout":
              var views = await vscode.workspace
                .findFiles(path.join(REL_LAYOUTS, "**"), null)
                .then(res => {
                  return res.map(i => {
                    let name = vscode.workspace
                        .asRelativePath(i)
                        .substring(REL_LAYOUTS.length + 1)
                        .split(".")[0],
                      item = new vscode.CompletionItem(name);
                    item.insertText =
                      triggerCharacter == TriggerCharacter.colon
                        ? " '" + name + "'"
                        : name;
                    item.kind = vscode.CompletionItemKind.File;
                    return item;
                  });
                });
              suggestions.push(...views);
              break;
          }
        }
      }

      resolve(suggestions);
    });
  }
}
