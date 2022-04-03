// original taken from https://github.com/luca-montaigut/SkeemaParser/blob/main/js/skeemaParser.js
export default class SkeemaParser {
  /**
   * schema content
   */
  schema: string;
  skipTimestamps: boolean;
  skipActiveStorage: boolean;
  table: string;
  result: Record<string,Record<string, string | string[]>>;
  constructor(schema:string, skipTimestamps = true, skipActiveStorage = true) {
    this.schema = schema;
    this.skipTimestamps = skipTimestamps;
    this.skipActiveStorage = skipActiveStorage;
    this.table = '';
    this.result = {};
  }

  parse = () => {
    const allLines = this.schema.split(/\r\n|\n/);
    if (!this.isSchemaDotRbFile(allLines)) {
      console.error('Not a "schema.rb" file');
      return false;
    }

    allLines.forEach((line) => {
      this.processLine(line);
    });

    return this.result;
  };

  isSchemaDotRbFile = (allLines: string[]) => {
    return Boolean(
      allLines.find((line) => line.trim().match(/ActiveRecord::Schema/))
    );
  };

  processLine = (line: string) => {
    this.table ? this.parseTableLine(line) : this.findNewTable(line);
  };

  parseTableLine = (line: string) => {
    if (line.trim().match(/^end$/)) {
      return this.endTable();
    }

    const columnName = this.extractColumnName(line);
    const columnType = this.extractColumnType(line);

    if (columnType === 'index') {
      this.addIndex(columnType, columnName);
    } else if (
      (columnName === 'created_at' && this.skipTimestamps) ||
      (columnName === 'updated_at' && this.skipTimestamps)
    ) {
      return;
    } else {
      this.addColumn(columnType, columnName);
    }
  };

  findNewTable = (line: string) => {
    this.table = this.extractTableName(line);
    if (this.table) {
      this.startTable(this.table);
    }
  };

  extractTableName = (line: string): string => {
    let tableName: string;
    if (line.trim().match(/create_table (\S+)/)) {
      tableName = line.split('"')[1];
    }
    if (
      (tableName === 'active_storage_attachments' && this.skipActiveStorage) ||
      (tableName === 'active_storage_blobs' && this.skipActiveStorage)
    ) {
      return '';
    }
    return tableName;
  };

  extractColumnName = (column: string) => {
    return column.trim().split(' ')[1].split('"')[1];
  };
  extractColumnType = (column: string) => {
    return column.trim().split(' ')[0].split('.')[1];
  };

  startTable = (tableName: string) => {
    this.result[tableName] = {};
  };

  endTable = () => {
    this.table = '';
  };

  addColumn = (type: string, name: string) => {
    this.result[this.table][name] = type;
  };

  addIndex = (type: string, name: string) => {
    if (!this.result[this.table][type]) {
      this.result[this.table][type] = [];
    }
    (this.result[this.table][type] as string[]).push(name);
  };
}

// Parser for schema.rb file Rails 5+ (maybe before but untested)
// return {tableName: {columnName: columnType, ... , index: [columnName, ...]} ...}
// Based on : https://github.com/rubysolo/skeema
