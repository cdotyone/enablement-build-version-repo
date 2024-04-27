#!/usr/bin/env node
import path from 'path';
import { readFile, writeFile, existsSync } from "fs";
import { exec } from "child_process";

import { Version } from "./version.mjs";

async function updateVersion(projectFile, version, suffix) {
  var value = new Promise((resolve, reject) => {
    readFile(projectFile, "utf8", (error, data) => {
      if (error) {
        console.log(error);
        reject(error);
        return;
      }
      let versionFile = JSON.parse(data);
      if(versionFile["version"]!==version) {
        if(options.suffix && !version.endsWith(options.suffix)) version+='-'+options.suffix;
        versionFile["version"] = version;
        writeFile(projectFile, JSON.stringify(versionFile, null, 2), "utf8",
            (error) => {
              if (error) {
                console.log(error);
                reject(error);
                return;
              }
              resolve("OK");
            });
      } else resolve("NOT NEEDED");
    });

  });

  return value;
}

async function main(options) {
	return new Promise(async (mainResolve, mainreject) => {
		const projectFile = path.join("./package.json");
		if(!existsSync(projectFile)) return resolve("NOT FOUND");

		let result = await Version(projectFile, options, {});

    if(result.build)
      console.log(`##vso[task.setvariable variable=build;isoutput=true;]1`);
    else
      console.log(`##vso[task.setvariable variable=build;isoutput=true;]0`);

		let plist=[];

		if(options.version) {
			if(options.debug) console.log(result);
			let safeName = result.name;
			safeName=safeName.replace(/-/g,'_');
			if(result.build) {
				console.log(`##vso[task.setvariable variable=${safeName};isoutput=true;]${result.version}`);
				console.log(`##vso[task.setvariable variable=tag;isoutput=true;]${result.version}`);
				if(options.saveVersion) {
					plist.push(updateVersion(projectFile,result.version,options.suffix));
				}
			} else {
				console.log(`##vso[task.setvariable variable=${safeName};isoutput=true;]${result.previous}`);
				console.log(`##vso[task.setvariable variable=tag;isoutput=true;]${result.previous}`);
			}
		}
		if(options.tag) {
			plist.push(new Promise((resolve,reject)=>{
			let rev=options.longTagname ? result.name+'@'+result.version : "v"+result.version;
      if(options.suffix && !rev.endsWith(options.suffix)) rev+='-'+options.suffix;
			exec(`git describe --tags ${rev}`, (err, tag, stderr) => {
				if (err) {
					exec(`git tag ${rev} -m "${rev}"`, (err, tag, stderr) => {
					if (err) {
						reject(err);
						return;
					}
					resolve(rev);
					});
					return;
				}
			});
			}));
		}

		Promise.allSettled(plist).then(()=>{
			mainResolve("OK");
		},mainreject);
	});
}


let options = {
    saveVersion:false,
    changed:false,
    version:false,
    tag:false,
    longTagname:false,
    suffix:'',
    commit:false,
    debug:false,
    hashFile:".cicd/hash.json",
    hashExcludeFolders:['node_modules', 'coverage', 'dist'],
    hashExcludeFiles:['.npmrc','CHANGELOG.md','README.md'],
    dependencies:"dependencies.json"
};

if (process.argv.length === 2) {
  console.error('Expected at least one argument!');
  process.exit(1);
} else {
  let argv = process.argv;
  for(let i=2;i<argv.length;i++) {
    if(argv[i]==="--save") options.saveVersion=true;
    else if(argv[i]==="--debug") options.debug=true;
    else if(argv[i]==="--changed") options.changed=true;
    else if(argv[i]==="--version") options.version=true;
    else if(argv[i]==="--hash") options.hash=true;
    else if(argv[i]==="--tag") options.tag=true;
    else if(argv[i]==="--longtag") options.longTagname=true;
	else
    if(argv[i].substring(0,2)==="--") {
      let name = argv[i].substring(2);
      if(options[name]!==undefined) {
          options[name] = argv[i+1];
          i++;
      } else {
          console.error(`Expected a known option, got ${argv[i]}`);
          process.exit(1);
      }
    }
  }
}

(async () => {
  try {
      const text = await main(options);
      console.log(text);
  } catch (e) {
      console.log(e);
      process.exit(1);
  }
})();
