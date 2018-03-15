'use strict';

import vscode = require('vscode');
import path = require('path');
import fs = require('fs');
import { dectFileType } from "../src/utils";
import { RailsHelper } from "../src/rails_helper";
import {
	FileType, FileTypeRelPath,
	REL_CONTROLLERS,
	REL_CONTROLLERS_CONCERNS,
	REL_MODELS,
	REL_MODELS_CONCERNS,
	REL_VIEWS,
	REL_LAYOUTS,
	REL_HELPERS,
	REL_JAVASCRIPTS,
	REL_STYLESHEETS,
	PATTERNS
} from "../src/constants";
import inflection = require('inflection');

const missingToolMsg = 'Missing tool: ';

export interface RailsDefinitionInformation {
	file: string;
	line?: number;
	column?: number;
	doc?: string;
	// declarationlines: string[];
	name?: string;
	// toolUsed: string;
}

export function isPositionInString(document: vscode.TextDocument, position: vscode.Position): boolean {
	let lineText = document.lineAt(position.line).text;
	let lineTillCurrentPosition = lineText.substr(0, position.character);

	// Count the number of double quotes in the line till current position. Ignore escaped double quotes
	let doubleQuotesCnt = (lineTillCurrentPosition.match(/\"/g) || []).length;
	let escapedDoubleQuotesCnt = (lineTillCurrentPosition.match(/\\\"/g) || []).length;

	doubleQuotesCnt -= escapedDoubleQuotesCnt;
	return doubleQuotesCnt % 2 === 1;
}

export function controllerDefinitionLocation(document: vscode.TextDocument,word:string,lineText:string,prefix:string):Thenable<RailsDefinitionInformation>{
	let definitionInformation: RailsDefinitionInformation;
	if (PATTERNS.CLASS_INHERIT_DECLARATION.test(lineText)) {
		// exclude = REL_CONTROLLERS

		let [, parent] = lineText.split("<")[1], name,filePath;;
		if (parent == "ActionController::Base") {
			//@todo provide rails online doc link
			return Promise.reject(missingToolMsg + 'godef');
		}
		switch (prefix) {
			
			case "::":
				let seq = parent.split("::"),
					controllerName = seq[seq.length - 1];
				name = controllerName.substring(0, controllerName.indexOf("Controller")).toLowerCase(),
				filePath = path.join(vscode.workspace.rootPath, "app", "controllers", seq.slice(0, -1).join(path.sep), name + "_controller.rb");
				definitionInformation = {
					file: filePath
				};
				//@todo search gem path
				break;

			case "<":
				name = word.substring(0, word.indexOf("Controller")).toLowerCase(),
				filePath = path.join(path.dirname(document.fileName), name + "_controller.rb");
				definitionInformation = {
					file: filePath
				};
				break;

		}
	} else if (PATTERNS.FUNCTION_DECLARATON.test(lineText) && !PATTERNS.PARAMS_DECLARATION.test(word)) {
		let relativeFileName = vscode.workspace.asRelativePath(document.fileName),
			rh = new RailsHelper(relativeFileName, lineText);
		rh.showFileList();
		return Promise.reject(missingToolMsg + 'godef');
	} else if (PATTERNS.INCLUDE_DECLARATION.test(lineText)) {
		let concern = lineText.replace(PATTERNS.INCLUDE_DECLARATION, ""),
			seq = concern.split("::").map(inflection.underscore).filter((v) => v != ""),
			sub = seq.slice(0, -1).join(path.sep),
			name = seq[seq.length - 1],
		filePath = path.join(REL_CONTROLLERS_CONCERNS, sub, name + ".rb");
		definitionInformation = {
			file: filePath
		};
	} else if (PATTERNS.CAPITALIZED.test(word) && prefix == "::") {
		let arr = lineText.split("=").map(s => s.trim());
		let token = arr[arr.length - 1];
		let symbol = token.substring(0, token.lastIndexOf(word) + word.length)
		let seq = symbol.split("::").map(inflection.underscore).filter((v) => v != ""),
			sub = seq.slice(0, -1).join(path.sep),
			name = seq[seq.length - 1],
		filePath = path.join("lib", sub, name + ".rb");
		let uri = vscode.Uri.file(path.join(vscode.workspace.rootPath, filePath));
		return vscode.workspace.openTextDocument(uri).then(
			(document) => {
				let line = document.getText().split("\n").findIndex((line) => new RegExp("^class\\s+" + word).test(line.trim()));

				definitionInformation = {
					file: document.uri.fsPath,
					line: line
				};
				return Promise.resolve(definitionInformation)
			},
			() => { return Promise.reject(missingToolMsg + filePath); }
		)
	} else if (PATTERNS.CAPITALIZED.test(word)) {
		let
			name = inflection.underscore(word),
			filePath = path.join(REL_MODELS, "**", name + ".rb")
			;
		definitionInformation = {
			file: filePath
		};
	} else if (PATTERNS.PARAMS_DECLARATION.test(word)) {
		let filePath = document.fileName,
		    line = document.getText().split("\n").findIndex((line) => new RegExp("^def\\s+" + word).test(line.trim()))
		definitionInformation = {
			file: filePath,
			line: line
		};
	}
	if (definitionInformation) {
		let promise = new Promise<RailsDefinitionInformation>(
			definitionResolver(document,definitionInformation)
		);

		return promise;
	} else {
		return Promise.reject(missingToolMsg + 'godef');
	}
	
}

var FileTypeHandlers = new Map([
	[FileType.Controller,controllerDefinitionLocation]
]);

export function definitionResolver(document,definitionInformation,exclude=null,maxNum=null)  {
	return (resolve, reject) => {vscode.workspace.findFiles(vscode.workspace.asRelativePath(definitionInformation.file), exclude, 1).then(
		(uris: vscode.Uri[]) => {
			if (!uris.length) {
				reject(missingToolMsg + definitionInformation.file)
			} else if(uris.length ==1) { definitionInformation.file = uris[0].fsPath; resolve(definitionInformation) }
			else{
				let relativeFileName = vscode.workspace.asRelativePath(document.fileName),
					rh = new RailsHelper(relativeFileName,null);
				rh.showQuickPick(uris.map( uri => vscode.workspace.asRelativePath((uri.path) )));
			}
		},
		() => { reject(missingToolMsg + definitionInformation.file) }
	)
}
}

export function definitionLocation(document: vscode.TextDocument, position: vscode.Position, goConfig: vscode.WorkspaceConfiguration, includeDocs: boolean, token: vscode.CancellationToken): Thenable<RailsDefinitionInformation> {
	let wordRange = document.getWordRangeAtPosition(position);
	let lineText = document.lineAt(position.line).text.trim();
	let word = wordRange ? document.getText(wordRange) : '';
	let prefixPos = wordRange.start.translate(0, -2)
	let prefix = document.getText(new vscode.Range(prefixPos, wordRange.start)).trim()
	let suffixPos = wordRange.end.translate(0, 2)
	let suffix = document.getText(new vscode.Range(wordRange.end, suffixPos)).trim();
	if (!wordRange || lineText.startsWith('//') || isPositionInString(document, position) || word.match(/^\d+.?\d+$/) || suffix == "::") {
		return Promise.resolve(null);
	}
	if (!goConfig) {
		goConfig = vscode.workspace.getConfiguration('rails');
	}
	let toolForDocs = goConfig['docsTool'] || 'godoc';
	let fileType = dectFileType(document.fileName)
	
	let exclude;
	return FileTypeHandlers.get(FileType.Controller)(document,word,lineText,prefix);
}

export class RailsDefinitionProvider implements vscode.DefinitionProvider {
	private goConfig = null;

	constructor(goConfig?: vscode.WorkspaceConfiguration) {
		this.goConfig = goConfig;
	}

	public provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.Location> {
		return definitionLocation(document, position, this.goConfig, false, token).then(definitionInfo => {
			if (definitionInfo == null || definitionInfo.file == null) return null;
			let definitionResource = vscode.Uri.file(definitionInfo.file);
			let pos = new vscode.Position(definitionInfo.line, definitionInfo.column);
			return new vscode.Location(definitionResource, pos);
		}, err => {
			if (err) {
				// Prompt for missing tool is located here so that the
				// prompts dont show up on hover or signature help
				if (typeof err === 'string' && err.startsWith(missingToolMsg)) {
					// promptForMissingTool(err.substr(missingToolMsg.length));
				} else {
					return Promise.reject(err);
				}
			}
			return Promise.resolve(null);
		});
	}
}
