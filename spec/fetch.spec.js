/**
    Licensed to the Apache Software Foundation (ASF) under one
    or more contributor license agreements.  See the NOTICE file
    distributed with this work for additional information
    regarding copyright ownership.  The ASF licenses this file
    to you under the Apache License, Version 2.0 (the
    "License"); you may not use this file except in compliance
    with the License.  You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
    Unless required by applicable law or agreed to in writing,
    software distributed under the License is distributed on an
    "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, either express or implied.  See the License for the
    specific language governing permissions and limitations
    under the License.
*/

/* eslint-env jasmine */

var fetch = require('..');
var uninstall = fetch.uninstall;

var path = require('path');
var fs = require('fs-extra');
var helpers = require('./helpers.js');

var tmpDir, opts;

beforeEach(function () {
    opts = {};
    tmpDir = helpers.tmpDir();
    process.chdir(tmpDir);
});

afterEach(function () {
    process.chdir(__dirname); // Needed to rm the dir on Windows.
    fs.removeSync(tmpDir);
});

function fetchAndMatch (target, pkgProps) {
    pkgProps = pkgProps || { name: target };
    return fetch(target, tmpDir, opts)
        .then(expectPackageToMatch(pkgProps));
}

function expectPackageToMatch (pkgProps) {
    return result => {
        expect(result).toBeDefined();
        expect(fs.existsSync(result)).toBe(true);
        const pkg = fs.readJsonSync(path.join(result, 'package.json'));
        expect(pkg).toEqual(jasmine.objectContaining(pkgProps));
        return result;
    };
}

function expectNotToBeInstalled (pkgName) {
    expect(fs.existsSync(path.join(tmpDir, 'node_modules', pkgName))).toBe(false);
}

function expectDependenciesToBe (deps) {
    const rootPJ = fs.readJsonSync(path.join(tmpDir, 'package.json'));
    expect(rootPJ.dependencies).toEqual(deps);
}

describe('fetch/uninstall tests via npm & git', function () {

    it('should fetch and uninstall a cordova platform via npm & git', function () {
        return Promise.resolve()
            .then(_ => fetchAndMatch('cordova-android'))
            .then(_ => uninstall('cordova-android', tmpDir, opts))
            .then(_ => expectNotToBeInstalled('cordova-android'))

            .then(_ => fetchAndMatch('https://github.com/apache/cordova-browser.git', { name: 'cordova-browser' }))
            .then(_ => uninstall('cordova-browser', tmpDir, opts))
            .then(_ => expectNotToBeInstalled('cordova-browser'));
    }, 120000);

    it('should fetch a scoped plugin from npm', function () {
        return fetchAndMatch('@stevegill/cordova-plugin-device');
    }, 30000);
});

describe('fetch/uninstall with --save', function () {

    beforeEach(function () {
        opts = {save: true};
        // copy package.json from spec directory to tmpDir
        fs.copySync(path.join(__dirname, 'testpkg.json'), 'package.json');
    });

    it('should fetch and uninstall a cordova platform via npm & git tags/branches', function () {
        return Promise.resolve()
            // npm tag
            .then(_ => fetchAndMatch('cordova-android@5.1.1', {
                name: 'cordova-android',
                version: '5.1.1'
            }))
            .then(_ => expectDependenciesToBe({'cordova-android': '^5.1.1'}))
            .then(_ => uninstall('cordova-android', tmpDir, opts))
            .then(_ => expectDependenciesToBe({}))
            .then(_ => expectNotToBeInstalled('cordova-android'))

            // git tag
            .then(_ => fetchAndMatch('https://github.com/apache/cordova-ios.git#rel/4.1.1', {
                name: 'cordova-ios',
                version: '4.1.1'
            }))
            .then(_ => expectDependenciesToBe({'cordova-ios': 'git+https://github.com/apache/cordova-ios.git#rel/4.1.1'}))
            .then(_ => uninstall('cordova-ios', tmpDir, opts))
            .then(_ => expectDependenciesToBe({}))
            .then(_ => expectNotToBeInstalled('cordova-ios'))

            // git branch
            .then(_ => fetchAndMatch('https://github.com/apache/cordova-android.git#4.1.x', {
                name: 'cordova-android',
                version: '4.1.1'
            }))
            .then(_ => expectDependenciesToBe({'cordova-android': 'git+https://github.com/apache/cordova-android.git#4.1.x'}))
            .then(_ => uninstall('cordova-android', tmpDir, opts));
    }, 150000);

    it('should fetch and uninstall a cordova plugin via git commit sha', function () {
        const URL = 'https://github.com/apache/cordova-plugin-contacts.git#7db612115755c2be73a98dda76ff4c5fd9d8a575';
        return Promise.resolve()
            .then(_ => fetchAndMatch(URL, {
                name: 'cordova-plugin-contacts',
                version: '2.0.2-dev'
            }))
            .then(_ => expectDependenciesToBe({'cordova-plugin-contacts': `git+${URL}`}))
            .then(_ => uninstall('cordova-plugin-contacts', tmpDir, opts))
            .then(_ => expectDependenciesToBe({}))
            .then(_ => expectNotToBeInstalled('cordova-plugin-contacts'));
    }, 30000);
});

describe('fetching already installed packages', function () {

    beforeEach(function () {
        fs.copySync(path.join(__dirname, 'support'), 'support');
    });

    it('should return package path for registry packages', function () {
        return Promise.resolve()
            .then(_ => fetchAndMatch('cordova-plugin-device'))
            .then(_ => fetchAndMatch('cordova-plugin-device'));
    }, 40000);

    it('should return package path if git repo name differs from plugin id', function () {
        const TARGET = 'https://github.com/AzureAD/azure-activedirectory-library-for-cordova.git';
        return Promise.resolve()
            .then(_ => fetchAndMatch(TARGET, { name: 'cordova-plugin-ms-adal' }))
            .then(_ => fetchAndMatch(TARGET, { name: 'cordova-plugin-ms-adal' }));
    }, 120000);

    it('should return package path if using a relative path', function () {
        const TARGET = 'file:support/dummy-local-plugin';
        return Promise.resolve()
            .then(_ => fetchAndMatch(TARGET, { name: 'test-plugin' }))
            .then(_ => fetchAndMatch(TARGET, { name: 'test-plugin' }));
    }, 120000);

    it('should return package path for git+http variants', function () {
        return Promise.resolve()
            .then(_ => fetchAndMatch('github:apache/cordova-plugin-device', { name: 'cordova-plugin-device' }))
            .then(_ => fetchAndMatch('https://github.com/apache/cordova-plugin-device', { name: 'cordova-plugin-device' }))
            .then(_ => fetchAndMatch('git+https://github.com/apache/cordova-plugin-device', { name: 'cordova-plugin-device' }));
    }, 60000);
});

describe('negative tests', function () {

    it('should fail fetching a module that does not exist on npm', function () {
        return fetch('NOTAMODULE', tmpDir, opts)
            .then(function (result) {
                console.log('This should fail and it should not be seen');
            })
            .fail(function (err) {
                expect(err.message.code).toBe(1);
                expect(err).toBeDefined();
            });
    }, 30000);

    it('should fail fetching a giturl which contains a subdirectory', function () {
        return fetch('https://github.com/apache/cordova-plugins.git#:keyboard', tmpDir, opts)
            .then(function (result) {
                console.log('This should fail and it should not be seen');
            })
            .fail(function (err) {
                expect(err.message.code).toBe(1);
                expect(err).toBeDefined();
            });
    }, 30000);
});
