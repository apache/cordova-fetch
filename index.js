/**
 Licensed to the Apache Software Foundation (ASF) under one
 or more contributor license agreements.  See the NOTICE file
 distributed with this work for additional information
 regarding copyright ownership.  The ASF licenses this file
 to you under the Apache License, Version 2.0 (the
 'License'); you may not use this file except in compliance
 with the License.  You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing,
 software distributed under the License is distributed on an
 'AS IS' BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 KIND, either express or implied.  See the License for the
 specific language governing permissions and limitations
 under the License.
 */

var Q = require('q');
var which = Q.denodeify(require('which'));
var superspawn = require('cordova-common').superspawn;
var events = require('cordova-common').events;
var path = require('path');
var fs = require('fs-extra');
var CordovaError = require('cordova-common').CordovaError;

/*
 * A function that npm installs a module from npm or a git url
 *
 * @param {String} target   the packageID or git url
 * @param {String} dest     destination of where to install the module
 * @param {Object} opts     [opts={save:true}] options to pass to fetch module
 *
 * @return {String|Promise}    Returns string of the absolute path to the installed module.
 *
 */
module.exports = function (target, dest, opts = {}) {
    var fetchArgs = opts.link ? ['link'] : ['install'];
    var nodeModulesDir = dest;

    // check if npm is installed
    return module.exports.isNpmInstalled()
        .then(function () {
            if (dest && target) {
                // add target to fetchArgs Array
                fetchArgs.push(target);

                // append node_modules to nodeModulesDir if it doesn't come included
                if (path.basename(dest) !== 'node_modules') {
                    nodeModulesDir = path.resolve(path.join(dest, 'node_modules'));
                }
                // create node_modules if it doesn't exist
                fs.ensureDirSync(nodeModulesDir);
            } else throw new CordovaError('Need to supply a target and destination');

            // set the directory where npm install will be run
            opts.cwd = dest;

            // npm should use production by default when install is npm run
            if ((opts.production) || (opts.production === undefined)) {
                fetchArgs.push('--production');
                opts.production = true;
            }

            // if user added --save flag, pass it to npm install command
            if (opts.save_exact) {
                events.emit('verbose', 'saving exact');
                fetchArgs.push('--save-exact');
            } else if (opts.save) {
                events.emit('verbose', 'saving');
                fetchArgs.push('--save');
            } else {
                fetchArgs.push('--no-save');
            }
        })
        .then(function () {
            // install new module
            return superspawn.spawn('npm', fetchArgs, opts);
        })
        .then(extractPackageName)
        .then(pkgName => path.resolve(nodeModulesDir, pkgName))
        .catch(function (err) {
            throw new CordovaError(err);
        });
};

function extractPackageName (npmInstallOutput) {
    const lines = npmInstallOutput.split('\n');
    let spec;
    if (lines[0].startsWith('+ ')) {
        // npm >= 5
        spec = lines[0].slice(2);
    } else if (lines[1].startsWith('└─') || lines[1].startsWith('`-')) {
        // 3 <= npm <= 4
        spec = lines[1].slice(4);
    } else {
        throw new CordovaError('Could not determine package name from output:\n' + npmInstallOutput);
    }

    // Strip version from spec
    const parts = spec.split('@');
    const isScoped = parts.length > 1 && parts[0] === '';
    return isScoped ? '@' + parts[1] : parts[0];
}

/*
 * Checks to see if npm is installed on the users system
 * @return {Promise|Error} Returns true or a cordova error.
 */

function isNpmInstalled () {
    return which('npm').catch(_ => {
        throw new CordovaError('"npm" command line tool is not installed: make sure it is accessible on your PATH.');
    });
}

module.exports.isNpmInstalled = isNpmInstalled;
/*
 * A function that deletes the target from node_modules and runs npm uninstall
 *
 * @param {String} target   the packageID
 * @param {String} dest     destination of where to uninstall the module from
 * @param {Object} opts     [opts={save:true}] options to pass to npm uninstall
 *
 * @return {Promise|Error}    Returns a promise with the npm uninstall output or an error.
 *
 */
module.exports.uninstall = function (target, dest, opts) {
    var fetchArgs = ['uninstall'];
    opts = opts || {};

    // check if npm is installed on the system
    return isNpmInstalled()
        .then(function () {
            if (dest && target) {
                // add target to fetchArgs Array
                fetchArgs.push(target);
            } else throw new CordovaError('Need to supply a target and destination');

            // set the directory where npm uninstall will be run
            opts.cwd = dest;

            // if user added --save flag, pass it to npm uninstall command
            if (opts.save) {
                fetchArgs.push('--save');
            } else {
                fetchArgs.push('--no-save');
            }

            // run npm uninstall, this will remove dependency
            // from package.json if --save was used.
            return superspawn.spawn('npm', fetchArgs, opts);
        })
        .catch(function (err) {
            throw new CordovaError(err);
        });
};
