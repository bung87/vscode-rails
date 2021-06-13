#!/usr/bin/env node

/*
 gen symbols through online document(in sdoc format) which contains search_index.js
 about sdoc:https://github.com/zzak/sdoc
*/

var rp = require('axios').default;
var fs = require("fs");
var path = require("path");
var Trie = require('dawg-lookup').Trie

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
                theVar = JSON.parse(js.data.replace(/var\s+search_data\s+=\s+/, "")),
                index = theVar["index"],
                longSearchIndex = index["longSearchIndex"],
                uni = longSearchIndex.filter((value, index, self) => self.indexOf(value) === index && value !== ""),
                _list = typeof MAP[key]["filter"] == "function" ? uni.filter(MAP[key].filter) : uni;
                console.log("list is array",Array.isArray(_list));
            let list = JSON.stringify(_list, null, 4);
            let
                // trie = new Trie(_list),
                // packed = trie.pack()
                // import {PTrie} from 'dawg-lookup/lib/ptrie';\n
                // const packed = '${packed}';\n
                imports = "import trie from 'trie-prefix-tree';\n",
                content = `${COMMENT}${imports}const list = ${list};\nexport const ${key.toUpperCase()} = trie(list);\nexport const VERSION = "${value.version}"`;
            // if (key === "rails"){
            //         console.log("actioncontroller::base is word",trie.isWord("actioncontroller::base"))
            //     }
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