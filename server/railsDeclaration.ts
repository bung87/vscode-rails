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

function wordsToPath(s) {
	return inflection.underscore(s.replace(/[A-Z]{2,}(?![a-z])/, (s) => { return inflection.titleize(s) }))
}

export function getConcernsFilePath(lineStartToWord, fileT: FileType) {
	let concern = lineStartToWord.replace(PATTERNS.INCLUDE_DECLARATION, ""),
		seq = concern.split("::").map(wordsToPath);
	if (seq[0] == "concerns") delete seq[0]
	let
		sub = seq.slice(0, -1).join(path.sep),
		name = seq[seq.length - 1],
		fileType = FileTypeRelPath.get(fileT),
		filePath = path.join(fileType, sub, name + ".rb");
	return filePath
}

export function findClassInDocumentCallback(name, document) {
	let
		line = document.getText().split("\n").findIndex((line) => new RegExp("^class\\s+.*" + name).test(line.trim())),
		definitionInformation = {
			file: document.uri.fsPath,
			line: Math.max(line, 0)
		};
	return Promise.resolve(definitionInformation)
}

export function getLibOrModelFilePath(lineStartToWord, word) {
	let symbol = new RegExp("(((::)?[A-Za-z]+)*(::)?" + word + ")").exec(lineStartToWord)[1];
	let seq = symbol.split("::").map(wordsToPath).filter((v) => v != ""),
		sub = seq.slice(0, -1).join(path.sep),
		name = seq[seq.length - 1],
		filePathInModels = path.join(REL_MODELS, "**", sub, name + ".rb"),
		filePathInLib = path.join("lib", sub, name + ".rb"),
		fileModulePathInLib = path.join("lib", name + ".rb");
	let findFileModuleInLib = vscode.workspace.findFiles(fileModulePathInLib, null, 1).then(
		(uris: vscode.Uri[]) => {

			if (!uris.length) {
				return Promise.reject(missingFilelMsg + findFileModuleInLib);
			}
			return vscode.workspace.openTextDocument(uris[0]).then(
				findClassInDocumentCallback.bind(null, name),
				() => { return Promise.reject(couldNotOpenMsg + fileModulePathInLib); }
			)
		},
		() => { return Promise.reject(missingFilelMsg + filePathInLib); }
	);
	let findInLib = vscode.workspace.findFiles(filePathInLib, null, 1).then(
		(uris: vscode.Uri[]) => {
			if (!uris.length) {
				return findFileModuleInLib
			}
			return vscode.workspace.openTextDocument(uris[0]).then(
				findClassInDocumentCallback.bind(null, name),
				() => { return Promise.reject(couldNotOpenMsg + filePathInLib); }
			)
		},
		() => { return findFileModuleInLib }
	);
	return vscode.workspace.findFiles(filePathInModels, null, 1).then(
		(uris: vscode.Uri[]) => {
			if (!uris.length) {
				return findInLib
			}
			return vscode.workspace.openTextDocument(uris[0]).then(
				findClassInDocumentCallback.bind(null, name),
				() => { return Promise.reject(couldNotOpenMsg + filePathInModels); }
			)
		},
		() => {
			return findInLib
		}
	)
}

export function findLocationByWord(document: vscode.TextDocument, position: vscode.Position, word: string, lineStartToWord: string) {
	if (PATTERNS.CAPITALIZED.test(word)) {
		return getLibOrModelFilePath(lineStartToWord, word)
	} else {
		let
			fileNameWithoutSuffix = path.parse(document.fileName).name,
			controllerName = inflection.camelize(fileNameWithoutSuffix);
		return findFunctionOrClassByClassName(document, position, word, controllerName);
	}
}

export function controllerDefinitionLocation(document: vscode.TextDocument, position: vscode.Position, word: string, lineStartToWord: string): Thenable<RailsDefinitionInformation> {
	let definitionInformation: RailsDefinitionInformation = {
		file: null,
		line: 0
	};
	if (PATTERNS.CLASS_INHERIT_DECLARATION.test(lineStartToWord)) {
		// exclude = REL_CONTROLLERS
		// if (parentController == "ActionController::Base") {
		// 	//@todo provide rails online doc link
		// 	return Promise.reject(missingToolMsg + 'godef');
		// }
		let filePath = getParentControllerFilePathByDocument(document, lineStartToWord);
		definitionInformation.file = filePath;
	} else if (PATTERNS.FUNCTION_DECLARATON.test(lineStartToWord) && !PATTERNS.PARAMS_DECLARATION.test(word)) {
		let
			sameModuleControllerSub = path.dirname(vscode.workspace.asRelativePath(document.fileName).substring(REL_CONTROLLERS.length + 1)),
			filePath = path.join(REL_VIEWS, sameModuleControllerSub, path.basename(document.fileName).replace(/_controller\.rb$/, ""), word + "*"),
			upperText = document.getText(new vscode.Range(new vscode.Position(0, 0), position)),
			isPrivateMethod = /\s*private/.test(upperText);
		if (isPrivateMethod) {
			return Promise.resolve(null);
		}
		definitionInformation.file = filePath;
	} else if (PATTERNS.INCLUDE_DECLARATION.test(lineStartToWord)) {
		definitionInformation.file = getConcernsFilePath(lineStartToWord, FileType.ControllerConcerns);
	} else if (PATTERNS.CAPITALIZED.test(word)) {//lib or model combination
		return getLibOrModelFilePath(lineStartToWord, word)
	} else if (PATTERNS.PARAMS_DECLARATION.test(word)) {
		let filePath = document.fileName,
			line = document.getText().split("\n").findIndex((line) => new RegExp("^def\\s+" + word).test(line.trim()))
		definitionInformation.file = filePath;
		definitionInformation.line = line;
	} else if (PATTERNS.LAYOUT_DECLARATION.test(lineStartToWord)) {
		let layoutPath = PATTERNS.LAYOUT_MATCH.exec(lineStartToWord)[2];
		definitionInformation.file = path.join(REL_LAYOUTS, layoutPath + "*");
	} else if (PATTERNS.RENDER_DECLARATION.test(lineStartToWord)) {
		let
			match = PATTERNS.RENDER_MATCH.exec(lineStartToWord),
			viewPath = match[2],
			sub = vscode.workspace.asRelativePath(document.fileName).substring(REL_CONTROLLERS.length + 1).replace("_controller.rb", "");
		definitionInformation.file = path.join(REL_VIEWS, sub, viewPath + "*")
	} else if (PATTERNS.CONTROLLER_FILTERS.test(lineStartToWord)) {
		let
			fileNameWithoutSuffix = path.parse(document.fileName).name,
			controllerName = inflection.camelize(fileNameWithoutSuffix);
		return findFunctionOrClassByClassName(document, position, word, controllerName);
	} else if (PATTERNS.HELPER_METHODS.test(lineStartToWord)) {
		//@todo find in app/helpers
		let
			fileNameWithoutSuffix = path.parse(document.fileName).name,
			controllerName = inflection.camelize(fileNameWithoutSuffix);
		return findFunctionOrClassByClassName(document, position, word, controllerName);
	} else {
		return findLocationByWord(document, position, word, lineStartToWord)
	}
	let promise = new Promise<RailsDefinitionInformation>(
		definitionResolver(document, definitionInformation)
	);
	return promise;
}

export function getSymbolPath(relpath: string, line: string, fileType: FileType) {

	let
		[currentClassRaw, parentClassRaw] = line.split("<"),
		currentClass = currentClassRaw.trim(),
		parentClass = parentClassRaw.trim(),
		relPath = FileTypeRelPath.get(fileType);
	if (currentClass.includes("::") && !parentClass.includes("::")) {
		return path.join(relPath, wordsToPath(parentClass) + ".rb");
	}
	let parent = parentClass.trim(),
		sameModuleSub = path.dirname(relpath.substring(relPath.length + 1)),
		seq = parent.split("::").map(wordsToPath).filter((v) => v != ""),
		sub = !parent.includes("::") ? sameModuleSub : seq.slice(0, -1).join(path.sep),
		name = seq[seq.length - 1],
		filePath = path.join(relPath, sub, name + ".rb");
	return filePath
}

export function getParentControllerFilePathByDocument(entryDocument: vscode.TextDocument, line: string) {
	let

		relPath = vscode.workspace.asRelativePath(entryDocument.fileName),
		filePath = getSymbolPath(relPath, line, FileType.Controller)
	return filePath
}

export function getFunctionOrClassInfoInFile(fileAbsPath, reg): [RailsDefinitionInformation, string] {
	let
		definitionInformation: RailsDefinitionInformation = {
			file: null,
			line: 0,
			column: 0
		};
	var lineByLine = require('n-readlines');
	var liner = new lineByLine(fileAbsPath),
		line,
		lineNumber = 0,
		classDeclaration,
		lineIndex = -1;
	while (line = liner.next()) {
		let lineText = line.toString('utf8').trim();
		if (PATTERNS.CLASS_INHERIT_DECLARATION.test(lineText)) {
			classDeclaration = lineText;
		}
		if (reg.test(lineText)) {
			lineIndex = lineNumber
			definitionInformation.file = fileAbsPath
			definitionInformation.line = lineIndex;
			definitionInformation.column = lineText.length
			break;
		}
		lineNumber++;
	}
	return [definitionInformation, classDeclaration];
}
export function findFunctionOrClassByClassNameInFile(fileAbsPath, reg): RailsDefinitionInformation {
	//@todo find in included moduels
	var
		[definitionInformation, classDeclaration] = getFunctionOrClassInfoInFile(fileAbsPath, reg),
		lineIndex = definitionInformation.line
	while (-1 === lineIndex) {
		let
			[, symbol] = classDeclaration.split("<"),
			parentController = symbol.trim(),
			filePath = getSymbolPath(vscode.workspace.asRelativePath(fileAbsPath), parentController, FileType.Controller),
			fileAbsPath2 = path.join(vscode.workspace.rootPath, filePath);

		[definitionInformation, classDeclaration] = getFunctionOrClassInfoInFile(fileAbsPath2, reg);
		lineIndex = definitionInformation.line
	}
	if (-1 !== lineIndex) {
		return definitionInformation;
	}
}
export function findFunctionOrClassByClassName(entryDocument: vscode.TextDocument, position: vscode.Position, funcOrClass: string, clasName: string): Promise<RailsDefinitionInformation> {

	let
		definitionInformation: RailsDefinitionInformation = {
			file: null,
			line: 0,
			column: 0
		},
		lines = entryDocument.getText().split("\n"),
		regPrefix = /[a-z0-9_]/.test(funcOrClass) ? "^def\\s+" : "^class\\s+",
		reg = new RegExp(regPrefix + funcOrClass),
		lineIndex = lines.findIndex((line) => reg.test(line.trim()));
	if (-1 !== lineIndex) {
		// same file
		definitionInformation.file = entryDocument.uri.fsPath;
		definitionInformation.line = lineIndex;
		definitionInformation.column = lines[lineIndex].length
		return Promise.resolve(definitionInformation);
	} else {
		let
			beforeRange = new vscode.Range(new vscode.Position(0, 0), position),
			beforeText = entryDocument.getText(beforeRange),
			beforeLines = beforeText.split("\n");
		let
			line = beforeLines.find((line) => new RegExp("^class\\s+.*" + clasName).test(line.trim())),
			filePath = getParentControllerFilePathByDocument(entryDocument, line),
			fileAbsPath = path.join(vscode.workspace.rootPath, filePath);
		return new Promise<RailsDefinitionInformation>(
			(resolve, reject) => {
				let definitionInformation = findFunctionOrClassByClassNameInFile(fileAbsPath, reg)
				resolve(definitionInformation)
			}
		)


	}
}

export function modelDefinitionLocation(document: vscode.TextDocument, position: vscode.Position, word: string, lineStartToWord: string): Thenable<RailsDefinitionInformation> {
	let definitionInformation: RailsDefinitionInformation = {
		file: null,
		line: 0
	};
	let
		reg = new RegExp("(^has_one|^has_many|^has_and_belongs_to_many|^belongs_to)\\s+:" + word);
	if (reg.test(lineStartToWord)) {
		let name = inflection.singularize(word);
		definitionInformation.file = path.join(REL_MODELS, "**", name + ".rb");
	} else if (PATTERNS.INCLUDE_DECLARATION.test(lineStartToWord)) {
		definitionInformation.file = getConcernsFilePath(lineStartToWord, FileType.ModelConcerns);
	} else if (PATTERNS.CAPITALIZED.test(word)) {
		return getLibOrModelFilePath(lineStartToWord, word)
	} else {
		return findLocationByWord(document, position, word, lineStartToWord)
	}
	let promise = new Promise<RailsDefinitionInformation>(
		definitionResolver(document, definitionInformation)
	);

	return promise;
}
var FileTypeHandlers = new Map([
	[FileType.Controller, controllerDefinitionLocation],
	[FileType.Model, modelDefinitionLocation],
	[FileType.Unkown, findLocationByWord]
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
	let lineStartToWord = document.getText(new vscode.Range(new vscode.Position(position.line, 0), wordRange.end)).trim();
	let word = wordRange ? document.getText(wordRange) : '';
	if (!wordRange || lineText.startsWith('//') || word.match(/^\d+.?\d+$/)) {
		return Promise.resolve(null);
	}
	if (!goConfig) {
		goConfig = vscode.workspace.getConfiguration('rails');
	}
	let fileType = dectFileType(document.fileName)
	let exclude;
	return FileTypeHandlers.get(fileType)(document, position, word, lineStartToWord);
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
