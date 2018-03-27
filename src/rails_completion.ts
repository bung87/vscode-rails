'use strict';

import vscode = require('vscode');
import cp = require('child_process');
import { isPositionInString,dectFileType } from "./utils";
import { definitionLocation } from './railsDeclaration';
import { FileType } from "./constants"

export function modelQueryInterface(){
    var suggestions: vscode.CompletionItem[] = [];
    let query_methods = ["find_by","first","last","take","find","find_each", "find_in_batches","create_with","distinct","eager_load","extending","from","group","having","includes","joins","left_outer_joins","limit","lock","none","offset","order","preload","readonly","references","reorder","reverse_order","select","where"];
    query_methods.forEach((value)=>{
        let item = new vscode.CompletionItem(value);
        item.insertText = value;
        item.kind = vscode.CompletionItemKind.Method
        suggestions.push(item)
    });
    return suggestions
}

export class RailsCompletionItemProvider implements vscode.CompletionItemProvider {

    private pkgsList = new Map<string, string>();

    public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.CompletionItem[]> {
        return this.provideCompletionItemsInternal(document, position, token, vscode.workspace.getConfiguration('rails', document.uri));
    }

    public  provideCompletionItemsInternal(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, config: vscode.WorkspaceConfiguration): Promise<vscode.CompletionItem[]> {
     
        return new Promise<vscode.CompletionItem[]>( async (resolve, reject) => {
            var suggestions: vscode.CompletionItem[] = [];
            let filename = document.fileName;
            let lineText = document.lineAt(position.line).text;
            let lineTillCurrentPosition = lineText.substr(0, position.character);
            // let autocompleteUnimportedPackages = config['autocompleteUnimportedPackages'] === true && !lineText.match(/^(\s)*(import|package)(\s)+/);
            if (lineText.match(/^\s*\/\//)) {
                return resolve([]);
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

            try{
                let info =  await definitionLocation(document, position);
                let fileType = dectFileType(info.file)
    
                switch(fileType){
                    case FileType.Model:
                    suggestions.push(...modelQueryInterface())
                    break;
                }
                resolve(suggestions);
            }catch(e){
                console.error(e)
                reject(e)
                
            }
           
            
           
        });
       


    }
}









