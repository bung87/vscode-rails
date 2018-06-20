#!/usr/bin/env node

/*
 gen symbols through online document(in sdoc format) which contains search_index.js
 about sdoc:https://github.com/zzak/sdoc
*/

var rp = require("request-promise-native");
var fs = require("fs");
var path = require("path");


const ROOT = path.dirname(__dirname);
const DEST = path.join(ROOT, "src", "symbols");
const COMMENT = `// This file generated through ./bin/gen_symbols.js,Do NOT modify it!\n`;
const MAP = {
    rails: {
        url: "http://api.rubyonrails.org/js/search_index.js",
        version: "5.2.0"
    },
    ruby: {
        url: "http://docs.rubydocs.org/ruby-2-5-1/js/search_index.js",
        version: "2.5.1",
        filter: (value, index, self) => {
            return value.indexOf("::") === -1 ? self.find((v) => {
                return v.indexOf(`${value}::`) !== -1
            }) : true
        }
    }
};

function gen(key, value) {
    rp(value.url)
        .then(function (js) {
            let
                theVar = JSON.parse(js.replace(/var\s+search_data\s+=\s+/, "")),
                index = theVar["index"],
                longSearchIndex = index["longSearchIndex"],
                uni = longSearchIndex.filter((value, index, self) => self.indexOf(value) === index && value !== ""),
                exclude_foo_bar = typeof MAP[key]["filter"] == "function" ? uni.filter(MAP[key].filter) : uni,
                list = JSON.stringify(exclude_foo_bar, null, 4),
                content = `${COMMENT}export const ${key.toUpperCase()} = new Set(${list});\nexport const VERSION = "${value.version}"`;
            fs.writeFile(path.join(DEST, `${key}.ts`), content, function (err) {
                if (err) {
                    return console.error(err);
                }
                console.log(`The file ${key}.ts was saved!`);
            });
        })
        .catch(function (err) {
            // Crawling failed...
            console.log(err);
        });
}

for (let x in MAP) {
    gen(x, MAP[x])
}