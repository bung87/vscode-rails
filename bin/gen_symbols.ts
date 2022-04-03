/*
 gen symbols through online document(in sdoc format) which contains search_index.js
 about sdoc:https://github.com/zzak/sdoc
*/

import rp from 'axios'
import fs from "fs";
import path from "path";
import { CompactPrefixTree } from "../src/thirdparty/compact-prefix-tree";

const ROOT = path.dirname(__dirname);
const DEST = path.join(ROOT, "src", "symbols");
const COMMENT = `// This file generated through ./bin/gen_symbols.js,Do NOT modify it!\n`;
const MAP = {
    rails: {
        url: "https://api.rubyonrails.org/js/search_index.js",
        version: "5.2.0"
    },
    ruby: {
        url: "https://docs.rubydocs.org/ruby-2-5-1/js/search_index.js",
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
            let
                trie = new CompactPrefixTree(_list),
                serialized = JSON.stringify(trie.T),
                imports = `import { CompactPrefixTree, getWordsFromTrie } from 'compact-prefix-tree' ;\n`,
                content = `${COMMENT}${imports}const serialized = '${serialized}';\nconst words = getWordsFromTrie(JSON.parse(serialized));\nexport const ${key.toUpperCase()} = new CompactPrefixTree(Array.from(words));\nexport const VERSION = "${value.version}"`;
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
