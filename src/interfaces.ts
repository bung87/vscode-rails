import { RailsFileType } from './rails/file';

export interface RailsDefinitionInformation {
  file: string; // relative glob pattern
  line: number;
  fileType?: RailsFileType;
  column: number;
  doc?: string;
  name?: string;
}
