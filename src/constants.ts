import { dirname, join,sep, basename } from 'path';
export const REL_CONTROLLERS = join("app","controllers");
export const REL_MODELS =  join("app","models");
export const REL_VIEWS =  join("app","views");
export const REL_LAYOUTS = join("app","views","layouts");
export const REL_HELPERS = join("app","helpers");
export const REL_JAVASCRIPTS = join("app","assets","javascripts");
export const REL_STYLESHEETS = join("app","assets","stylesheets");
export const REL_SPEC = "spec"
export const REL_TEST = "test"
export const REL_CONTROLLERS_CONCERNS = join("app","controllers","concerns");
export const REL_MODELS_CONCERNS =  join("app","models","concerns");
export enum FileType {
    Controller,
    ControllerConcerns,
    Model,
    ModelConcerns,
    Layout,
    View,
    Helper,
    Javascript,
    StyleSheet,
    Rspec,
    Test,
    Unkown
}
export var FileTypeRelPath = new Map([
    [FileType.Controller,REL_CONTROLLERS],
    [FileType.ControllerConcerns,REL_CONTROLLERS_CONCERNS],
    [FileType.Model,REL_MODELS],
    [FileType.ModelConcerns,REL_MODELS_CONCERNS],
    [FileType.Layout,REL_LAYOUTS],
    [FileType.View,REL_VIEWS],
    [FileType.Helper,REL_HELPERS],
    [FileType.Javascript,REL_JAVASCRIPTS],
    [FileType.StyleSheet,REL_STYLESHEETS],
    [FileType.Rspec,REL_SPEC],
    [FileType.Test,REL_TEST],
]);

export const PATTERNS = {
    CLASS_INHERIT_DECLARATION : /^class\s+[^<]+<\s+/,
    FUNCTION_DECLARATON:/^def\s+/,
    INCLUDE_DECLARATION:/^include\s+/,
    CAPITALIZED:/^[A-Z]/,
    PARAMS_DECLARATION:/_params$/,
    LAYOUT_DECLARATION:/^layout\s+/,
    LAYOUT_MATCH:/^layout\s+(['":]?([A-Za-z\/0-9_]+)['"]?)/,
    RENDER_DECLARATION:/^render\s+/,
    RENDER_MATCH:/^render\s+(['":]?([A-Za-z\/0-9_]+)['"]?)/,
    MODEL_RELATIONS:/^has_one|^has_many|^has_and_belongs_to_many|^belongs_to/
}