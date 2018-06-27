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
const { getInstalledPath } = require('get-installed-path');
const npa = require('npm-package-arg');
const semver = require('semver');

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
    return Q()
        .then(function () {
            if (!dest || !target) {
                throw new CordovaError('Need to supply a target and destination');
            }
            // Create dest if it doesn't exist yet
            fs.ensureDirSync(dest);
        })
        .then(_ => {
            return pathToInstalledPackage(target, dest)
                .catch(_ => installPackage(target, dest, opts));
        })
        .catch(function (err) {
            throw new CordovaError(err);
        });
};

// Installs the package specified by target and returns the installation path
function installPackage (target, dest, opts) {
    return isNpmInstalled()
        .then(_ => npmArgs(target, opts))
        .then(args => {
            events.emit('verbose', `fetch: Installing ${target} to ${dest}`);
            return superspawn.spawn('npm', args, { cwd: dest });
        })
        .then(getTargetPackageSpecFromNpmInstallOutput)
        .then(spec => pathToInstalledPackage(spec, dest));
}

function npmArgs (target, userOptions) {
    const opts = Object.assign({ production: true }, userOptions);

    const args = ['install', target];

    if (opts.production) {
        args.push('--production');
    }
    if (opts.save_exact) {
        args.push('--save-exact');
    } else if (opts.save) {
        args.push('--save');
    } else {
        args.push('--no-save');
    }
    return args;
}

function getTargetPackageSpecFromNpmInstallOutput (npmInstallOutput) {
    const lines = npmInstallOutput.split('\n');
    if (lines[0].startsWith('+ ')) {
        // npm >= 5
        return lines[0].slice(2);
    } else if (lines[1].startsWith('└─') || lines[1].startsWith('`-')) {
        // 3 <= npm <= 4
        return lines[1].slice(4).split(' ')[0];
    } else {
        throw new CordovaError('Could not determine package name from output:\n' + npmInstallOutput);
    }
}

// Resolves to installation path of package defined by spec if the right version
// is installed, rejects otherwise.
function pathToInstalledPackage (spec, dest) {
    const { name, rawSpec } = npa(spec, dest);
    return getInstalledPath(name, { local: true, cwd: dest })
        .then(installPath => {
            const { version } = fs.readJsonSync(path.join(installPath, 'package.json'));
            if (!semver.satisfies(version, rawSpec)) {
                throw new CordovaError(`Installed package ${name}@${version} does not satisfy ${name}@${rawSpec}`);
            }
            return installPath;
        });
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
