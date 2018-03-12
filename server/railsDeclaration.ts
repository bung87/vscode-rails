'use strict';

import vscode = require('vscode');
import cp = require('child_process');
import path = require('path');
import fs = require('fs');
import { dectFileType } from "../src/utils";
import { FileType } from "../src/constants";

const missingToolMsg = 'Missing tool: ';

export interface RailsDefinitionInformation {
	file: string;
	line: number;
	column: number;
	doc: string;
	// declarationlines: string[];
	name: string;
	// toolUsed: string;
}
export function byteOffsetAt(document: vscode.TextDocument, position: vscode.Position): number {
	let offset = document.offsetAt(position);
	let text = document.getText();
	return Buffer.byteLength(text.substr(0, offset));
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

export function definitionLocation(document: vscode.TextDocument, position: vscode.Position, goConfig: vscode.WorkspaceConfiguration, includeDocs: boolean, token: vscode.CancellationToken): Promise<RailsDefinitionInformation> {
	let wordRange = document.getWordRangeAtPosition(position);
	let lineText = document.lineAt(position.line).text;
	let word = wordRange ? document.getText(wordRange) : '';
	if (!wordRange || lineText.startsWith('//') || isPositionInString(document, position) || word.match(/^\d+.?\d+$/)) {
		return Promise.resolve(null);
	}
	if (!goConfig) {
		goConfig = vscode.workspace.getConfiguration('rails');
	}
	let toolForDocs = goConfig['docsTool'] || 'godoc';
	let offset = byteOffsetAt(document, position);
	let fileType = dectFileType(document.fileName)
	if (fileType === FileType.Controller) {
		let prefixPos = wordRange.start.translate(0, -2)
		let prefix = document.getText(new vscode.Range(prefixPos, wordRange.start))
		let name, filePath, definitionInformation: RailsDefinitionInformation;
		switch (prefix.trim()) {
			case "::":
				let parent = lineText.split("<")[1].trim()
				if (parent == "ActionController::Base") {
					//@todo provide rails online doc link
					break;
				}
				let seq = parent.split("::");
				word = seq[seq.length - 1]
				name = word.substring(0, word.indexOf("Controller")).toLowerCase();
				filePath = path.join(vscode.workspace.rootPath, "app", "controllers", seq.slice(0, -1).join(path.sep), name + "_controller.rb");
				definitionInformation = {
					file: filePath,
					line: 0,
					column: 0,
					// declarationlines: lines.splice(1),
					// toolUsed: 'godef',
					doc: null,
					name: null
				};
				//@todo search gem path
				return fs.existsSync(filePath) && Promise.resolve(definitionInformation);
			case "<":
				name = word.substring(0, word.indexOf("Controller")).toLowerCase();
				filePath = path.join(path.dirname(document.fileName), name + "_controller.rb");
				definitionInformation = {
					file: filePath,
					line: 0,
					column: 0,
					// declarationlines: lines.splice(1),
					// toolUsed: 'godef',
					doc: null,
					name: null
				};
				return fs.existsSync(filePath) && Promise.resolve(definitionInformation);

		}
	}

	return Promise.reject(missingToolMsg + 'godef');

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
