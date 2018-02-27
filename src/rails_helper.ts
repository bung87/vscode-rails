'use strict';
import * as vscode from 'vscode';
import { dirname, join,sep, basename } from 'path';

var inflection = require('inflection');

enum FileType {
    Controller = 1,
    Model,
    Layout,
    View,
    Helper,
    Javascript,
    StyleSheet,
    Rspec,
    Test
}
const REL_CONTROLLERS = join("app","controllers");
const REL_MODELS =  join("app","models");
const REL_VIEWS =  join("app","views");
const REL_LAYOUTS = join("app","layouts");
const REL_HELPERS = join("app","helpers");
const REL_JAVASCRIPTS = join("app","assets","javascripts");
const REL_STYLESHEETS = join("app","assets","stylesheets");
const REL_SPEC = "spec"
const REL_TEST = "test"

export class RailsHelper {
    private fileName: string;
    private filePath: string;
    private fileType: FileType;
    private filePatten: string;
    private relativeFileName;
    private line: string;//@TODO detect by current line
    private targetFile:string;

    public constructor(relativeFileName:string,line:string) {
        this.relativeFileName = relativeFileName;
        this.fileName = basename(relativeFileName);
        this.filePath = dirname(relativeFileName);
        this.line = line;
        this.dectFileType();
    }

    private patterns = [
        join(REL_CONTROLLERS,"PTN","*"),
        join(REL_CONTROLLERS,"PTN*"),
        join(REL_MODELS,"SINGULARIZE","*"),
        join(REL_MODELS,"SINGULARIZE*"),

        join(REL_MODELS,"BASENAME_SINGULARIZE","*"),
        join(REL_MODELS,"BASENAME_SINGULARIZE*"),

        join(REL_VIEWS,"PTN","*"),
        join(REL_VIEWS,"PTN*"),

        join(REL_LAYOUTS,"PTN","*"),
        join(REL_LAYOUTS,"PTN*"),

        join(REL_HELPERS,"PTN","*"),
        join(REL_HELPERS,"PTN*"),

        join(REL_JAVASCRIPTS,"PTN","*"),
        join(REL_JAVASCRIPTS,"PTN*"),

        join(REL_STYLESHEETS,"PTN","*"),
        join(REL_STYLESHEETS,"PTN*")
    ]

    public searchPaths() {
        var res = [];
        this.patterns.forEach(e => {
            var p = e.replace("PTN", this.filePatten.toString());
            p = p.replace("BASENAME_SINGULARIZE", inflection.singularize( basename(this.filePatten.toString()) ));
            p = p.replace("SINGULARIZE", inflection.singularize(this.filePatten.toString()));
            res.push(p);
        });
        return res;
    }
    private dectFileType() {
        this.filePatten = null;
        this.targetFile = null;
        if (this.filePath.indexOf(REL_CONTROLLERS + sep) >= 0) {
            this.fileType = FileType.Controller
            let prefix = this.filePath.substring(REL_CONTROLLERS.length + 1)
            this.filePatten = join(prefix ,this.fileName.replace(/_controller\.rb$/, ""));
        } else if (this.filePath.indexOf(REL_MODELS + sep) >= 0) {
            this.fileType = FileType.Model
            let prefix = this.filePath.substring(REL_MODELS.length + 1)
            this.filePatten = join(prefix,this.fileName.replace(/\.rb$/, ""));
            //DONE pluralize
            this.filePatten = inflection.pluralize(this.filePatten.toString())
        } else if (this.filePath.indexOf(REL_LAYOUTS + sep) >= 0) {
            this.fileType = FileType.Layout
            let prefix = this.filePath.substring(REL_LAYOUTS.length + 1)
            this.filePatten = join(prefix,this.fileName.replace(/\..*?\..*?$/, ""));
        } else if (this.filePath.indexOf(REL_VIEWS + sep) >= 0) {
            this.fileType = FileType.View
            let prefix = this.filePath.substring(REL_VIEWS.length + 1)
            this.filePatten = prefix;
        } else if (this.filePath.indexOf(REL_HELPERS + sep) >= 0) {
            this.fileType = FileType.Helper
            let prefix = this.filePath.substring(REL_HELPERS.length + 1)
            this.filePatten = join(prefix,this.fileName.replace(/_helper\.rb$/, ""));
        } else if (this.filePath.indexOf(REL_JAVASCRIPTS + sep) >= 0) {
            this.fileType = FileType.Javascript
            let prefix = this.filePath.substring(REL_JAVASCRIPTS.length + 1)
            this.filePatten = join(prefix,this.fileName.replace(/\.js$/, "").replace(/\..*?\..*?$/, ""));
        } else if (this.filePath.indexOf(REL_STYLESHEETS + sep) >= 0) {
            this.fileType = FileType.StyleSheet
            let prefix = this.filePath.substring(REL_STYLESHEETS.length + 1)
            this.filePatten = join(prefix,this.fileName.replace(/\.css$/, "").replace(/\..*?\..*?$/, ""));
        } else if (this.filePath.indexOf(REL_SPEC + sep) >= 0) {
            this.fileType = FileType.Rspec
            let prefix = this.filePath.substring(REL_SPEC.length + 1)
            this.targetFile =  join("app",prefix,this.fileName.replace("_spec.rb",".rb"));
        } else if (this.filePath.indexOf(REL_TEST + sep) >= 0) {
            this.fileType = FileType.Test
            let prefix = this.filePath.substring(REL_TEST.length + 1)
            this.filePatten = join("app",prefix,this.fileName.replace("_test.rb",".rb"));
        }
    }

    public items = [];
    private generateList(arr: Array<String>) {
        var cur = arr.pop();

        var _self = this;
        vscode.workspace.findFiles(cur.toString(),null).then((res) => {
            res.forEach(i => {
                var fn = vscode.workspace.asRelativePath(i);
                if(_self.relativeFileName !== fn)
                _self.items.push(fn);
            });
            if (arr.length > 0) {
                _self.generateList(arr);
            } else {

                this.showQuickPick(_self.items);
            }
        });

    }

    public showQuickPick(items: any) {
        const p = vscode.window.showQuickPick(items, { placeHolder: "Select File", matchOnDetail: true });
        p.then(value => {
            if(!value) return;
            const fn = vscode.Uri.parse('file://' + join(vscode.workspace.rootPath, value));
            vscode.workspace.openTextDocument(fn).then(doc => {
                return vscode.window.showTextDocument(doc);
            });
        })
    }

    public showFileList() {
        if (this.filePatten != null) {
            var paths = this.searchPaths().slice();
            this.generateList(paths)
        }else if(this.targetFile != null){
            this.generateList([this.targetFile]);
        }
    }
}