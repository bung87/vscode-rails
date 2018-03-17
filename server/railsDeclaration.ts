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

const missingFilelMsg = 'Missing file: ';
const couldNotOpenMsg = 'Could Not Open file: ';

export interface RailsDefinitionInformation {
	file: string;
	line: number;
	column?: number;
	doc?: string;
	// declarationlines: string[];
	name?: string;
	// toolUsed: string;
}

function wordsToPath(s){
	return inflection.underscore(s.replace(/[A-Z]{2,}(?![a-z])/,(s) => { return inflection.titleize(s)}))
}

export function controllerDefinitionLocation(document: vscode.TextDocument, position: vscode.Position, word: string, lineText: string, prefix: string): Thenable<RailsDefinitionInformation> {
	let definitionInformation: RailsDefinitionInformation = {
		file:null,
		line:0
	};
	if (PATTERNS.CLASS_INHERIT_DECLARATION.test(lineText)) {
		// exclude = REL_CONTROLLERS

		let [, parentController] = lineText.split("<");
		parentController = parentController.trim()
		// if (parentController == "ActionController::Base") {
		// 	//@todo provide rails online doc link
		// 	return Promise.reject(missingToolMsg + 'godef');
		// }
		let 
			sameModuleControllerSub = path.dirname(vscode.workspace.asRelativePath(document.fileName).substring(REL_CONTROLLERS.length+1)),
			seq = parentController.split("::").map(wordsToPath).filter((v) => v != ""),
			sub = prefix == "<" ? sameModuleControllerSub :seq.slice(0, -1).join(path.sep),
			name = seq[seq.length - 1],
			filePath = path.join(REL_CONTROLLERS, sub, name + ".rb");
		definitionInformation.file = filePath;
	} else if (PATTERNS.FUNCTION_DECLARATON.test(lineText) && !PATTERNS.PARAMS_DECLARATION.test(word)) {
		let 
			sameModuleControllerSub = path.dirname(vscode.workspace.asRelativePath(document.fileName).substring(REL_CONTROLLERS.length + 1)),
			filePath = path.join(REL_VIEWS,sameModuleControllerSub, path.basename(document.fileName).replace(/_controller\.rb$/, ""),word+"*"),
			upperText = document.getText(new vscode.Range( new vscode.Position(0,0), position)),
			isPrivateMethod = /\s*private/.test(upperText);
		if(isPrivateMethod){
			return Promise.resolve(null);
		}
		definitionInformation.file = filePath;
	} else if (PATTERNS.INCLUDE_DECLARATION.test(lineText)) {
		let concern = lineText.replace(PATTERNS.INCLUDE_DECLARATION, ""),
			seq = concern.split("::").map(wordsToPath);
			if (seq[0]=="concerns") delete seq[0]
		let
			sub = seq.slice(0, -1).join(path.sep),
			name = seq[seq.length - 1],
			filePath = path.join(REL_CONTROLLERS_CONCERNS, sub, name + ".rb");
		definitionInformation.file = filePath;
	} else if (PATTERNS.CAPITALIZED.test(word) ) {//lib or model combination
		let symbol = new RegExp("(((::)?[A-Za-z]+)*(::)?"+word+")").exec(lineText)[1];
		let seq = symbol.split("::").map(wordsToPath).filter((v) => v != ""),
			sub = seq.slice(0, -1).join(path.sep),
			name = seq[seq.length - 1],
			filePathInModels = path.join(REL_MODELS,"**", sub,name + ".rb"),
			filePathInLib = path.join("lib", sub, name + ".rb"),
			fileModulePathInLib = path.join("lib", name + ".rb");
		let findFileModuleInLib = vscode.workspace.findFiles(fileModulePathInLib, null, 1).then(
			(uris: vscode.Uri[]) => {

				if(!uris.length){
					return Promise.reject(missingFilelMsg + findFileModuleInLib); 
				}
				return vscode.workspace.openTextDocument(uris[0]).then(
					(document) => {
						let line = document.getText().split("\n").findIndex((line) => new RegExp("^class\\s+.*" + name).test(line.trim()));
		
						definitionInformation = {
							file: document.uri.fsPath,
							line: Math.max(line,0)
						};
						return Promise.resolve(definitionInformation)
					},
					() => { return Promise.reject(couldNotOpenMsg + fileModulePathInLib); }
				)
			},
			() => { return Promise.reject(missingFilelMsg + filePathInLib); }
		);
		let findInLib = vscode.workspace.findFiles(filePathInLib, null, 1).then(
			(uris: vscode.Uri[]) => {
				if(!uris.length){
					return findFileModuleInLib
				}
				return vscode.workspace.openTextDocument(uris[0]).then(
					(document) => {
						let line = document.getText().split("\n").findIndex((line) => new RegExp("^class\\s+.*" + name).test(line.trim()));
		
						definitionInformation = {
							file: document.uri.fsPath,
							line: Math.max(line,0)
						};
						return Promise.resolve(definitionInformation)
					},
					() => { return Promise.reject(couldNotOpenMsg + filePathInLib); }
				)
			},
			() => { return findFileModuleInLib }
		);
		return vscode.workspace.findFiles(filePathInModels, null, 1).then(
			(uris: vscode.Uri[]) => {
				if (!uris.length){
					return findInLib
				}
				return vscode.workspace.openTextDocument(uris[0]).then(
					(document) => {
						let line = document.getText().split("\n").findIndex((line) => new RegExp("^class\\s+.*" + name).test(line.trim()));
		
						definitionInformation = {
							file: document.uri.fsPath,
							line: Math.max(line,0)
						};
						return Promise.resolve(definitionInformation)
					},
					() => { return Promise.reject(couldNotOpenMsg + filePathInModels); }
				)
			},
			() => { 
				return findInLib
			}
		)
		
	}  else if (PATTERNS.PARAMS_DECLARATION.test(word)) {
		let filePath = document.fileName,
			line = document.getText().split("\n").findIndex((line) => new RegExp("^def\\s+" + word).test(line.trim()))
		definitionInformation.file = filePath;
		definitionInformation.line = line;
	}else if(PATTERNS.LAYOUT_DECLARATION.test(lineText)){
		let layoutPath = PATTERNS.LAYOUT_MATCH.exec(lineText)[2];
		definitionInformation.file = path.join(REL_LAYOUTS,layoutPath+"*");
	}else if(PATTERNS.RENDER_DECLARATION.test(lineText)){
		let 
			match = PATTERNS.RENDER_MATCH.exec(lineText),
			viewPath = match[2],
			// sameSub = match[1].charAt(0) == ":",
			sub = vscode.workspace.asRelativePath(document.fileName).substring(REL_CONTROLLERS.length+1).replace("_controller.rb","");
		definitionInformation.file = path.join(REL_VIEWS,sub, viewPath+"*")
	}
	if (definitionInformation) {
		let promise = new Promise<RailsDefinitionInformation>(
			definitionResolver(document, definitionInformation)
		);

		return promise;
	} else {
		return Promise.reject(missingFilelMsg + 'godef');
	}

}

var FileTypeHandlers = new Map([
	[FileType.Controller, controllerDefinitionLocation]
]);

export function definitionResolver(document, definitionInformation, exclude = null, maxNum = null) {
	return (resolve, reject) => {
		vscode.workspace.findFiles(vscode.workspace.asRelativePath(definitionInformation.file)).then(
			(uris: vscode.Uri[]) => {
				if (!uris.length) {
					reject(missingFilelMsg + definitionInformation.file)
				} else if (uris.length == 1) { definitionInformation.file = uris[0].fsPath; resolve(definitionInformation) }
				else {
					let relativeFileName = vscode.workspace.asRelativePath(document.fileName),
						rh = new RailsHelper(relativeFileName, null);
					rh.showQuickPick(uris.map(uri => vscode.workspace.asRelativePath((uri.path))));
				}
			},
			() => { reject(missingFilelMsg + definitionInformation.file) }
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
	if (!wordRange || lineText.startsWith('//')  || word.match(/^\d+.?\d+$/)) {
		return Promise.resolve(null);
	}
	if (!goConfig) {
		goConfig = vscode.workspace.getConfiguration('rails');
	}
	let fileType = dectFileType(document.fileName)

	let exclude;
	return FileTypeHandlers.get(FileType.Controller)(document,position, word, lineText, prefix);
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
				if (typeof err === 'string' && err.startsWith(missingFilelMsg)) {
					// promptForMissingTool(err.substr(missingToolMsg.length));
				} else {
					return Promise.reject(err);
				}
			}
			return Promise.resolve(null);
		});
	}
}
