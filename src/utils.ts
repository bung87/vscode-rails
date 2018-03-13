import { dirname, join, sep, basename } from 'path';
import { FileType, FileTypeRelPath } from "./constants"


export function dectFileType(filePath: string): FileType {
    for (var [key, value] of FileTypeRelPath) {
        if (filePath.indexOf(value ) >= 0) {
            return key
        }
    }
    return FileType.Unkown
}