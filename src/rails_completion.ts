/* eslint-disable @typescript-eslint/no-misused-promises */
'use strict';

import vscode from 'vscode';
import path from 'path';
import { dectFileType, findFiles } from './utils';
import { definitionLocation } from './rails_definition';
import micromatch from 'micromatch';
import fs from 'fs';
import readline from 'readline';

import { PATTERNS } from './constants';

import { NavigationHelper } from './navigation/navigation_helper';
import { RailsDefinitionInformation } from './interfaces';
import { FileType } from './rails/file';
import { Rails } from './rails';

export enum TriggerCharacter {
  dot,
  quote,
  colon,
}

export function modelQueryInterface(): vscode.CompletionItem[] {
  const suggestions: vscode.CompletionItem[] = [];

  Rails.queryMethods.forEach((value) => {
    const item = new vscode.CompletionItem(value);
    item.insertText = value;
    item.kind = vscode.CompletionItemKind.Method;
    suggestions.push(item);
  });
  return suggestions;
}

async function getCols(
  fileAbsPath: string,
  position: vscode.Position,
  triggerCharacter: TriggerCharacter,
  prefix?: string
): Promise<vscode.CompletionItem[]> {
  const fileStream = fs.createReadStream(fileAbsPath);

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });
  const cols: vscode.CompletionItem[] = [];
  for await (const lineText of rl) {
    if (/^#\s+([a-z0-9_]+)/.test(lineText)) {
      const col = /^#\s+([a-z0-9_]+)/.exec(lineText)[1];
      const name = prefix ? prefix + col : col;
      const item = new vscode.CompletionItem(name);
      item.insertText = name;
      item.kind = vscode.CompletionItemKind.Field;
      // @todo? move cusor next to quote eg. Client.where('locked' => true) :id=>
      cols.push(item);
    }
  }
  return cols;
}

async function getMethods(
  fileAbsPath: string
): Promise<vscode.CompletionItem[]> {
  const methods: vscode.CompletionItem[] = [];
  let markAsStart = false,
    markAsEnd = false;
  const fileStream = fs.createReadStream(fileAbsPath);

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });
  for await (const lineText of rl) {
    if (/^class\s+<<\s+self/.test(lineText)) {
      markAsStart = true;
      markAsEnd = false;
    }
    if (/^private$/.test(lineText)) {
      markAsEnd = true;
    }
    if (markAsEnd) continue;
    if (markAsStart && PATTERNS.FUNCTION_DECLARATON.test(lineText)) {
      const func = lineText.replace(PATTERNS.FUNCTION_DECLARATON, '');
      const item = new vscode.CompletionItem(func);
      item.insertText = func;
      item.kind = vscode.CompletionItemKind.Method;
      methods.push(item);
    }
  }

  return methods;
}

export class RailsCompletionItemProvider
  implements vscode.CompletionItemProvider {
  // private pkgsList = new Map<string, string>();
  public provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ) {
    return this.provideCompletionItemsInternal(
      document,
      position,
      token,
      vscode.workspace.getConfiguration('rails', document.uri)
    );
  }

  public async provideCompletionItemsInternal(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    config: vscode.WorkspaceConfiguration
  ): Promise<vscode.CompletionItem[]> {
    const suggestions: vscode.CompletionItem[] = [];
    const lineText = document.lineAt(position.line).text;
    const lineTillCurrentPosition = lineText.substr(0, position.character);
    console.log(`lineTillCurrentPosition:${lineTillCurrentPosition}`);
    const character =
      lineTillCurrentPosition[lineTillCurrentPosition.length - 1];
    // let autocompleteUnimportedPackages = config['autocompleteUnimportedPackages'] === true && !lineText.match(/^(\s)*(import|package)(\s)+/);
    if (lineText.match(/^\s*\/\//)) {
      return [];
    }
    let triggerCharacter: TriggerCharacter;
    switch (character) {
      case '.':
        triggerCharacter = TriggerCharacter.dot;
        break;
      case '"':
      case "'":
        triggerCharacter = TriggerCharacter.quote;
        break;
      case ':':
        triggerCharacter = TriggerCharacter.colon;
    }
    console.log(`triggerCharacter:${triggerCharacter}`);
    // let inString = isPositionInString(document, position);
    // if (!inString && lineTillCurrentPosition.endsWith('\"')) {
    //     return resolve([]);
    // }

    // get current word
    let position2 = new vscode.Position(position.line, position.character - 1);
    if (
      triggerCharacter === TriggerCharacter.dot &&
      PATTERNS.CLASS_STATIC_METHOD_CALL.test(lineTillCurrentPosition)
    ) {
      const [, id, model] = PATTERNS.CLASS_STATIC_METHOD_CALL.exec(
        lineTillCurrentPosition
      );
      position2 = new vscode.Position(position.line, lineText.indexOf(id));
    }
    const wordAtPosition = document.getWordRangeAtPosition(position2);
    if (!wordAtPosition) {
      return null;
    }
    const word = document.getText(wordAtPosition);
    let currentWord = '';
    if (wordAtPosition && wordAtPosition.start.character < position.character) {
      currentWord = word.substr(
        0,
        position.character - wordAtPosition.start.character
      );
    }
    if (currentWord.match(/^\d+$/)) {
      return [];
    }
    console.log(wordAtPosition, currentWord, character);
    if (triggerCharacter === TriggerCharacter.dot) {
      let info: RailsDefinitionInformation, fileType: FileType;
      let items: vscode.CompletionItem[];
      try {
        info = await definitionLocation(document, position2);
        fileType = dectFileType(info.file);
      } catch (e) {
        console.error(e);
        // reject(e);
      }
      switch (fileType) {
        case FileType.Model: // model static methods
          suggestions.push(...modelQueryInterface());
          {
            const methods = await getMethods(info.file);
            const cols = await getCols(
              info.file,
              position,
              triggerCharacter,
              'find_by_'
            );
            items = methods.concat(cols);
          }
          suggestions.push(...items);
          break;
      }
    } else if (
      triggerCharacter === TriggerCharacter.colon ||
      triggerCharacter === TriggerCharacter.quote
    ) {
      if (PATTERNS.CLASS_STATIC_METHOD_CALL.test(lineTillCurrentPosition)) {
        const [, id, model] = PATTERNS.CLASS_STATIC_METHOD_CALL.exec(
          lineTillCurrentPosition
        );
        const position2 = new vscode.Position(
          position.line,
          lineText.indexOf(id)
        );
        let info: RailsDefinitionInformation, fileType: FileType;
        try {
          info = await definitionLocation(document, position2);
          fileType = dectFileType(info.file);
        } catch (e) {
          console.error(e);
          // reject(e);
        }
        switch (fileType) {
          case FileType.Model: // model field suggestion
            {
              const cols = await getCols(info.file, position, triggerCharacter);
              suggestions.push(...cols);
            }
            break;
        }
      } else if (
        PATTERNS.RENDER_DECLARATION.test(lineTillCurrentPosition.trim()) ||
        PATTERNS.RENDER_TO_STRING_DECLARATION.test(
          lineTillCurrentPosition.trim()
        ) ||
        PATTERNS.LAYOUT_DECLARATION.test(lineTillCurrentPosition.trim())
      ) {
        const matches = lineTillCurrentPosition.match(/([a-z]+)/g),
          id = matches.pop();
        console.log('render type:' + id);
        let items: vscode.CompletionItem[];
        switch (id) {
          case 'partial': // @todo if it is not controller related partial
            {
              const
                rh = new NavigationHelper(document);
              const paths = rh.searchPaths().filter((v: string) => {
                return (
                  v.startsWith(Rails.Layouts) === false &&
                  v.startsWith(Rails.Views) === true
                );
              });
              console.log(`paths:${paths.toString()}`);
              items = await rh.generateList(paths).then((list) => {
                const partials = list
                  .map((v) => path.parse(v).name.split('.')[0])
                  .filter((v) => {
                    return v.startsWith('_');
                  });
                console.log(`partials:${partials.toString()}`);
                const items = partials.map((v: string) => {
                  const name = v.substring(1);
                  const item = new vscode.CompletionItem(name);
                  item.insertText =
                    triggerCharacter === TriggerCharacter.colon
                      ? " '" + name + "'"
                      : name;
                  item.kind = vscode.CompletionItemKind.File;
                  return item;
                });
                return items;
              });
              suggestions.push(...items);
            }
            break;
          case 'template': // @todo if it is base application controller or helper suggest all views
            {
              const rh = new NavigationHelper(document);
              const paths = rh.searchPaths().filter((v: string) => {
                return (
                  v.startsWith(Rails.Layouts) === false &&
                  v.startsWith(Rails.Views) === true
                );
              });

              items = await rh.generateList(paths).then((list) => {
                const templates = list
                  .map((v) =>
                    path.basename(
                      v.substring(Rails.Views.length + 1).split('.')[0]
                    )
                  )
                  .filter((v) => path.basename(v).startsWith('_') === false);
                const items = templates.map((v: string) => {
                  const name = v;
                  const item = new vscode.CompletionItem(name);
                  item.insertText =
                    triggerCharacter === TriggerCharacter.colon
                      ? " '" + name + "'"
                      : name;
                  item.kind = vscode.CompletionItemKind.File;
                  return item;
                });
                return items;
              });
              suggestions.push(...items);
              if (TriggerCharacter.quote === triggerCharacter) {
                items = await findFiles(
                  document,
                  path.join(Rails.Views, '**'),
                  Rails.Layouts
                ).then((res) => {
                  return res
                    .filter((v) => {
                      const p = vscode.workspace.asRelativePath(v);
                      return (
                        paths.some((v2) => {
                          return !micromatch([p], v2);
                        }) || path.basename(p).startsWith('_')
                      );
                    })
                    .map((i) => {
                      const name = vscode.workspace
                          .asRelativePath(i)
                          .substring(Rails.Views.length + 1)
                          .split('.')[0],
                        item = new vscode.CompletionItem(name);
                      item.insertText =
                        triggerCharacter === TriggerCharacter.colon
                          ? " '" + name + "'"
                          : name;
                      item.kind = vscode.CompletionItemKind.File;
                      return item;
                    });
                });
                suggestions.push(...items);
              }
            }
            break;
          case 'layout':
            {
              items = await findFiles(
                document,
                path.join(Rails.Layouts, '**'),
                null
              ).then((res) => {
                return res.map((i) => {
                  const name = vscode.workspace
                      .asRelativePath(i)
                      .substring(Rails.Layouts.length + 1)
                      .split('.')[0],
                    item = new vscode.CompletionItem(name);
                  item.insertText =
                    triggerCharacter === TriggerCharacter.colon
                      ? " '" + name + "'"
                      : name;
                  item.kind = vscode.CompletionItemKind.File;
                  return item;
                });
              });
              suggestions.push(...items);
            }
            break;
        }
      }
    }

    return suggestions;
  }
}
