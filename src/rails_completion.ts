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

export function modelQueryInterface():vscode.CompletionItem[] {
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

function getMethods(fileAbsPath):vscode.CompletionItem[] {
    var liner = new lineByLine(fileAbsPath),
        methods = [],
        line,
        lineNumber = 0,
        classDeclaration,
        markAsStart = false,
        markAsEnd = false,
        lineIndex = -1;
        // class << self
    while (line = liner.next()) {
        let lineText = line.toString('utf8').trim();
        if(/^class\s+<<\s+self/.test(lineText)){
            markAsStart = true;
            markAsEnd = false;
        }
        if(/^private$/.test(lineText)){
            markAsEnd= true
        }
        if(markAsEnd) continue;
        if (markAsStart  && PATTERNS.FUNCTION_DECLARATON.test(lineText)) {
            let func = lineText.replace(PATTERNS.FUNCTION_DECLARATON, "");
            let item = new vscode.CompletionItem(func);
            item.insertText = func;
            item.kind = vscode.CompletionItemKind.Method
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
            let character = lineText.substr(position.character - 1, position.character);
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
            try {
                let info = await definitionLocation(document, position2);
                let fileType = dectFileType(info.file)

                switch (fileType) {
                    case FileType.Model:
                        if (triggerCharacter == TriggerCharacter.dot) {
                            suggestions.push(...modelQueryInterface());
                            let methods = getMethods(info.file);
                            suggestions.push(...methods);
                        }

                        break;
                }
                resolve(suggestions);
            } catch (e) {
                console.error(e)
                reject(e)

            }



        });



    }
}









