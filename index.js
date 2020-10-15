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

const pify = require('pify');
const which = pify(require('which'));
const path = require('path');
const fs = require('fs-extra');
const { CordovaError, events, superspawn } = require('cordova-common');
const npa = require('npm-package-arg');
const semver = require('semver');

// pify's multiArgs unfortunately causes resolve to wrap errors in an Array.
// Thus we wrap the function again to unpack these wrapped errors.
const rslv = pify(require('resolve'), { multiArgs: true });
const resolve = (...args) => rslv(...args).catch(([err]) => { throw err; });

/**
 * Installs a module from npm, a git url or the local file system.
 *
 * @param {String} target       A spec for the package to be installed
 *                              (anything supported by `npm install`)
 * @param {String} dest         Location where to install the package
 * @param {Object} [opts={}]    Additional options
 *
 * @return {Promise<string>}    Absolute path to the installed package
 */
module.exports = async function (target, dest, opts = {}) {
    try {
        if (!dest || !target) {
            throw new CordovaError('Need to supply a target and destination');
        }

        // Create dest if it doesn't exist yet
        fs.ensureDirSync(dest);

        try {
            return await pathToInstalledPackage(target, dest);
        } catch {
            return await installPackage(target, dest, opts);
        }
    } catch (err) {
        throw new CordovaError(err);
    }
};

// Installs the package specified by target and returns the installation path
async function installPackage (target, dest, opts) {
    await isNpmInstalled();

    // Ensure that `npm` installs to `dest` and not any of its ancestors
    await fs.ensureDir(path.join(dest, 'node_modules'));

    // Run `npm` to install requested package
    const args = npmArgs(target, opts);
    events.emit('verbose', `fetch: Installing ${target} to ${dest}`);
    const npmInstallOutput = await superspawn.spawn('npm', args, { cwd: dest });

    // Resolve path to installed package
    const spec = await getTargetPackageSpecFromNpmInstallOutput(npmInstallOutput);
    return pathToInstalledPackage(spec, dest);
}

function npmArgs (target, opts) {
    const args = ['install', target];
    opts = opts || {};

    if (opts.save_exact) {
        args.push('--save-exact');
    } else if (opts.save) {
        args.push('--save-dev');
    } else {
        args.push('--no-save');
    }
    return args;
}

function getTargetPackageSpecFromNpmInstallOutput (npmInstallOutput) {
    const packageInfoLine = npmInstallOutput.split('\n')
        .find(line => line.startsWith('+ '));
    if (!packageInfoLine) {
        throw new CordovaError(`Could not determine package name from output:\n${npmInstallOutput}`);
    }
    return packageInfoLine.slice(2);
}

// Resolves to installation path of package defined by spec if the right version
// is installed, rejects otherwise.
async function pathToInstalledPackage (spec, dest) {
    const { name, rawSpec } = npa(spec, dest);
    if (!name) {
        throw new CordovaError(`Cannot determine package name from spec ${spec}`);
    }

    const [pkgPath, { version }] = await resolvePathToPackage(name, dest);
    if (!semver.satisfies(version, rawSpec)) {
        throw new CordovaError(`Installed package ${name}@${version} does not satisfy ${name}@${rawSpec}`);
    }

    return pkgPath;
}

// Resolves to installation path and package.json of package `name` starting
// from `basedir`
async function resolvePathToPackage (name, basedir) {
    const paths = (process.env.NODE_PATH || '')
        .split(path.delimiter)
        .filter(p => p);

    // We resolve the path to the module's package.json to avoid getting the
    // path to `main` which could be located anywhere in the package
    const [pkgJsonPath, pkgJson] = await resolve(`${name}/package.json`, { paths, basedir });

    return [path.dirname(pkgJsonPath), pkgJson];
}

/**
 * Checks to see if npm is installed on the users system
 *
 * @return {Promise<string>} Absolute path to npm.
 */
function isNpmInstalled () {
    return which('npm').catch(_ => {
        throw new CordovaError('"npm" command line tool is not installed: make sure it is accessible on your PATH.');
    });
}

module.exports.isNpmInstalled = isNpmInstalled;

/**
 * Uninstalls the package `target` from `dest` using given options.
 *
 * @param {String} target       Name of the package to be uninstalled
 * @param {String} dest         Location from where to uninstall the package
 * @param {Object} [opts={}]    Additional options
 *
 * @return {Promise<string>}    Resolves when removal has finished
 */
module.exports.uninstall = (target, dest, opts) => {
    const fetchArgs = ['uninstall'];
    opts = opts || {};

    // check if npm is installed on the system
    return isNpmInstalled()
        .then(() => {
            if (dest && target) {
                // add target to fetchArgs Array
                fetchArgs.push(target);
            } else throw new CordovaError('Need to supply a target and destination');

            // set the directory where npm uninstall will be run
            opts.cwd = dest;

            // if user added --save flag, pass --save-dev flag to npm uninstall command
            if (opts.save) {
                fetchArgs.push('--save-dev');
            } else {
                fetchArgs.push('--no-save');
            }

            // run npm uninstall, this will remove dependency
            // from package.json if --save was used.
            return superspawn.spawn('npm', fetchArgs, opts);
        })
        .catch(err => {
            throw new CordovaError(err);
        });
};
