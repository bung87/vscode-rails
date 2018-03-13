'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import { dirname, join, basename } from 'path';
import {  LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient';
import {RailsHelper}  from './rails_helper';
import { RailsDefinitionProvider } from '../server/railsDeclaration';

const RAILS_MODE: vscode.DocumentFilter = { language: 'ruby', scheme: 'file' };
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "rails" is now active!');
    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand('rails-nav', () => {
        // The code you place here will be executed every time your command is executed

        // Display a message box to the user
        //vscode.window.showInformationMessage('Hello World!');
        if(!vscode.window.activeTextEditor) {
            return;
        }

        var relativeFileName = vscode.workspace.asRelativePath(vscode.window.activeTextEditor.document.fileName);
      
        var line = vscode.window.activeTextEditor.document.lineAt(vscode.window.activeTextEditor.selection.active.line).text.trim()

        var rh = new RailsHelper(relativeFileName, line);
        rh.showFileList();
    });

    // The server is implemented in node
	let serverModule = context.asAbsolutePath(path.join('server', 'server.ts'));
	// The debug options for the server
	let debugOptions = { execArgv: ["--nolazy", "--debug=6009"] };

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	let serverOptions: ServerOptions = {
		run : { module: serverModule, transport: TransportKind.ipc },
		debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
	}

	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{scheme: 'file', language: 'ruby'}],
		synchronize: {
			// Synchronize the setting section 'lspSample' to the server
			configurationSection: 'lspSample',
			// Notify the server about file changes to '.clientrc files contain in the workspace
			fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
		}
	}

    context.subscriptions.push(disposable);
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(RAILS_MODE, new RailsDefinitionProvider()));
}
// this method is called when your extension is deactivated
export function deactivate() {
}