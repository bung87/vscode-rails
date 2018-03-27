'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import { dirname, join, basename } from 'path';
import { RailsHelper } from './rails_helper';
import { RailsDefinitionProvider } from './railsDeclaration';
import { RailsCompletionItemProvider } from './rails_completion';
const RAILS_MODE: vscode.DocumentFilter = { language: 'ruby', scheme: 'file' };

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function railsNavigation() {
    // The code you place here will be executed every time your command is executed

    // Display a message box to the user
    //vscode.window.showInformationMessage('Hello World!');
    if (!vscode.window.activeTextEditor) {
        return;
    }

    var relativeFileName = vscode.workspace.asRelativePath(vscode.window.activeTextEditor.document.fileName);

    var line = vscode.window.activeTextEditor.document.lineAt(vscode.window.activeTextEditor.selection.active.line).text.trim()

    var rh = new RailsHelper(relativeFileName, line);
    rh.showFileList();
}

export function activate(context: vscode.ExtensionContext) {

    context.subscriptions.push(vscode.commands.registerCommand('rails-nav', railsNavigation));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(RAILS_MODE, new RailsDefinitionProvider()));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(RAILS_MODE, new RailsCompletionItemProvider(), '.', '\"',":"));
}
// this method is called when your extension is deactivated
export function deactivate() {
}