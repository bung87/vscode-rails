
var fs = require("fs");
var process = require("process");
var path = require("path");
var glob = require("glob");
var root = path.resolve("./rails-master")
var exec = require('child_process').exec;
var version = process.argv.length >= 2 ? process.argv[1] : "master";

fs.readFileAsync = function (filename) {
    return new Promise(function (resolve, reject) {
        try {

            fs.readFile(filename, "utf8", function (err, data) {
                if (err) reject(err); else {
                    var symbols = [];
                    data.split("\n").forEach((line) => {
                        if (/[\"']/.test(line)) return;
                        if(/^\s*#/.test(line)) return;

                        var matches = new RegExp("(((::)?[A-Z](?!=[A-Z])[A-Za-z]+)*(::)?[A-Z](?!=[A-Z])[A-Za-z]+)").exec(line);
                        if (matches) {
                           -1 === matches[1].indexOf("Test") && symbols.push(matches[1].trim())
                        }
                    })
                    resolve(symbols);
                }
            });
        } catch (err) {
            reject(err);
        }
    });
};

function flatten(arr) {
    return arr.reduce(function (flat, toFlatten) {
        return flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten);
    }, []);
}

exec('git clone git@github.com:rails/rails.git', function callback(error, stdout, stderr) {
    if (error) {
        if (error.code === 128) {//fatal: destination path 'rails' already exists and is not an empty directory.
            console.log("'rails' already exists")
        }
    }
    exec('cd rails && git checkout ' + version, function callback(error2, stdout2, stderr2) {
        glob("**/*.rb", {
            root: root,
            nodir: true,
            ignore: "**/test/**",
            absolute: true
        }, function (er, files) {

            var syms = files.filter( (file)=> {
                return -1 === file.indexOf("test")
            }).map(
                (file) => {
                    return fs.readFileAsync(file)
                }
            );
            Promise.all(syms).then(function (symbols) {
                var fla = flatten(symbols)
                var uni = fla.filter((value, index, self) => self.indexOf(value) === index && /[A-Z]{2,}$/.test(value) === false)
                uni = uni.filter( (value) => {
                    return ["ApplicationController"].indexOf(value) == -1;
                })
                var content = "// This file generated through rails_symbols.js,Do NOT modify it!\nexport const RAILS = new Set(" + JSON.stringify(uni) + ");";
                fs.writeFile(path.join(__dirname, "src", "rails.ts"), content, function (err) {
                    if (err) {
                        return console.error(err);
                    }
                    console.log("The file was saved!");
                });
            }).catch(function (err) {
                console.error(err);
            });
        });

    });
});
