'use strict';

import vscode = require('vscode');
import cp = require('child_process');
import { isPositionInString, dectFileType } from "./utils";
import { definitionLocation } from './railsDeclaration';
import { FileType, PATTERNS } from "./constants"
import lineByLine = require('n-readlines');

export enum TriggerCharacter {
    dot,
    quote,
    colon
}

export function modelQueryInterface(): vscode.CompletionItem[] {
    var suggestions: vscode.CompletionItem[] = [];
    let query_methods = ["find_by", "first", "last", "take", "find", "find_each", "find_in_batches", "create_with", "distinct", "eager_load", "extending", "from", "group", "having", "includes", "joins", "left_outer_joins", "limit", "lock", "none", "offset", "order", "preload", "readonly", "references", "reorder", "reverse_order", "select", "where"];
    query_methods.forEach((value) => {
        let item = new vscode.CompletionItem(value);
        item.insertText = value;
        item.kind = vscode.CompletionItemKind.Method
        suggestions.push(item)
    });
    return suggestions
}
function getCols(fileAbsPath, position: vscode.Position, triggerCharacter: TriggerCharacter, prefix?: string): vscode.CompletionItem[] {
    var liner = new lineByLine(fileAbsPath),
        cols = [],
        line,
        lineNumber = 0,
        lineIndex = -1;
    while (line = liner.next()) {
        let lineText = line.toString('utf8').trim();

        if (/^#\s+([a-z0-9_]+)/.test(lineText)) {
            let col = /^#\s+([a-z0-9_]+)/.exec(lineText)[1];
            let name = prefix ? prefix + col : col;
            let item = new vscode.CompletionItem(name);
            item.insertText = name;
            item.kind = vscode.CompletionItemKind.Field;
            // @todo? move cusor next to quote eg. Client.where('locked' => true) :id=>
            cols.push(item)
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
    while (line = liner.next()) {
        let lineText = line.toString('utf8').trim();
        if (/^class\s+<<\s+self/.test(lineText)) {
            markAsStart = true;
            markAsEnd = false;
        }
        if (/^private$/.test(lineText)) {
            markAsEnd = true
        }
        if (markAsEnd) continue;
        if (markAsStart && PATTERNS.FUNCTION_DECLARATON.test(lineText)) {
            let func = lineText.replace(PATTERNS.FUNCTION_DECLARATON, "");
            let item = new vscode.CompletionItem(func);
            item.insertText = func;
            item.kind = vscode.CompletionItemKind.Method;
            methods.push(item)
        }
        lineNumber++;
    }
    return methods;
}

export class RailsCompletionItemProvider implements vscode.CompletionItemProvider {

    private pkgsList = new Map<string, string>();

    public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.CompletionItem[]> {
        return this.provideCompletionItemsInternal(document, position, token, vscode.workspace.getConfiguration('rails', document.uri));
    }

    public provideCompletionItemsInternal(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, config: vscode.WorkspaceConfiguration): Promise<vscode.CompletionItem[]> {

        return new Promise<vscode.CompletionItem[]>(async (resolve, reject) => {
            var suggestions: vscode.CompletionItem[] = [];
            let filename = document.fileName;
            let lineText = document.lineAt(position.line).text;
            let lineTillCurrentPosition = lineText.substr(0, position.character);
            let character = lineTillCurrentPosition[lineTillCurrentPosition.length - 1]
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


            // let inString = isPositionInString(document, position);
            // if (!inString && lineTillCurrentPosition.endsWith('\"')) {
            //     return resolve([]);
            // }

            // get current word
            let position2 = new vscode.Position(position.line, position.character - 1);
            let wordAtPosition = document.getWordRangeAtPosition(position2);
            let word = document.getText(wordAtPosition);
            let currentWord = '';
            if (wordAtPosition && wordAtPosition.start.character < position.character) {
                currentWord = word.substr(0, position.character - wordAtPosition.start.character);
            }
            if (currentWord.match(/^\d+$/)) {
                return resolve([]);
            }
            console.log(character)
            if (triggerCharacter == TriggerCharacter.dot) {
                let info, fileType;
                try {
                    info = await definitionLocation(document, position2);
                    fileType = dectFileType(info.file)

                } catch (e) {
                    console.error(e)
                    reject(e)
                }
                switch (fileType) {
                    case FileType.Model:
                        suggestions.push(...modelQueryInterface());
                        let methods = getMethods(info.file);
                        suggestions.push(...methods);
                        let cols = getCols(info.file, position, triggerCharacter, "find_by_");
                        console.log(cols)
                        suggestions.push(...cols);
                        break;
                }
            } else if (triggerCharacter == TriggerCharacter.colon || triggerCharacter == TriggerCharacter.quote) {
                if (PATTERNS.CLASS_STATIC_METHOD_CALL.test(lineTillCurrentPosition)) {
                    let [, id, model] = PATTERNS.CLASS_STATIC_METHOD_CALL.exec(lineTillCurrentPosition);
                    let position2 = new vscode.Position(position.line, lineText.indexOf(id));
                    let info, fileType;
                    try {
                        info = await definitionLocation(document, position2);
                        console.log(info)
                        fileType = dectFileType(info.file)
                    } catch (e) {
                        console.error(e)
                        reject(e)
                    }
                    switch (fileType) {
                        case FileType.Model:
                            let cols = getCols(info.file, position, triggerCharacter);
                            suggestions.push(...cols);
                            break;
                    }
                }
            }

            resolve(suggestions);

        });

    }
}