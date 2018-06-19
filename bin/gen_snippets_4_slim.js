#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = path.dirname(__dirname);

function replace(s) {
    return s.replace("<%\n", "").replace("%>", "").replace("<%", "")
}


fs.readFile(path.join(root, "snippets/html.erb.json"), 'utf8', (err, data) => {
    if (err) throw err;
    let obj = JSON.parse(data);
    for (let prefix in obj) {
        let body = obj[prefix].body;
        if (body.length === 3) {
            if (prefix === "content_for") {
                body[0] = "=" + replace(body[0]);
                body[1] = "  " + body[1];
                body[2] = "\n";

            } else {
                body[0] = replace(body[0]);
                body[1] = "  " + body[1];
                body[2] = "\n";
            }

        } else if (body.length === 1) {
            if (prefix === "content_for?") {
                obj[prefix].body = ["- if content_for?(:$1)", "  =yield (:$1)", "\n"]
            } else {
                body[0] = replace(body[0]);
            }

        }
    }
    delete obj["ruby-expression"]
    delete obj["begin"]
    fs.writeFileSync(path.join(__dirname, "snippets/slim.json"), JSON.stringify(obj, null, 4))
});