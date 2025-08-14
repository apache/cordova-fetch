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

const fetch = require('..');
const uninstall = fetch.uninstall;

const path = require('node:path');
const fs = require('node:fs');
const helpers = require('./helpers.js');

let tmpDir, opts;

beforeEach(() => {
    opts = {};
    tmpDir = helpers.tmpDir();
    process.chdir(tmpDir);
});

afterEach(() => {
    process.chdir(__dirname); // Needed to rm the dir on Windows.
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

function fetchAndMatch (target, pkgProps = { name: target }) {
    return fetch(target, tmpDir, opts)
        .then(expectPackageToMatch(pkgProps));
}

function expectPackageToMatch (pkgProps) {
    return result => {
        expect(result).toBeDefined();
        expect(fs.existsSync(result)).toBe(true);
        const pkg = JSON.parse(fs.readFileSync(path.join(result, 'package.json'), 'utf8'));
        expect(pkg).toEqual(jasmine.objectContaining(pkgProps));
        return result;
    };
}

function expectNotToBeInstalled (pkgName) {
    expect(fs.existsSync(path.join(tmpDir, 'node_modules', pkgName))).toBe(false);
}

function expectDevDependenciesToBe (deps) {
    const rootPJ = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf8'));
    expect(rootPJ.devDependencies || {}).toEqual(deps);
}

describe('fetch/uninstall tests via npm & git', () => {
    it('should fetch and uninstall a cordova platform via npm & git', () => {
        return Promise.resolve()
            .then(_ => fetchAndMatch('cordova-android'))
            .then(_ => uninstall('cordova-android', tmpDir, opts))
            .then(_ => expectNotToBeInstalled('cordova-android'))

            .then(_ => fetchAndMatch('https://github.com/apache/cordova-browser.git', { name: 'cordova-browser' }))
            .then(_ => uninstall('cordova-browser', tmpDir, opts))
            .then(_ => expectNotToBeInstalled('cordova-browser'));
    }, 60000);

    it('should fetch a scoped plugin from npm', () => {
        return fetchAndMatch('@stevegill/cordova-plugin-device');
    }, 30000);
});

describe('fetch/uninstall with --save', () => {
    beforeEach(() => {
        opts = { save: true };
        // copy package.json from spec directory to tmpDir
        fs.cpSync(path.join(__dirname, 'testpkg.json'), 'package.json');
    });

    it('should fetch and uninstall a cordova platform via npm & git tags/branches', () => {
        return Promise.resolve()
            // npm tag
            .then(_ => fetchAndMatch('cordova-android@8.1.0', {
                name: 'cordova-android',
                version: '8.1.0'
            }))
            .then(_ => expectDevDependenciesToBe({ 'cordova-android': '^8.1.0' }))
            .then(_ => uninstall('cordova-android', tmpDir, opts))
            .then(_ => expectDevDependenciesToBe({}))
            .then(_ => expectNotToBeInstalled('cordova-android'))

            // git tag
            .then(_ => fetchAndMatch('https://github.com/apache/cordova-ios.git#rel/5.0.1', {
                name: 'cordova-ios',
                version: '5.0.1'
            }))
            .then(_ => expectDevDependenciesToBe({ 'cordova-ios': jasmine.stringMatching('#rel/5.0.1') }))
            .then(_ => uninstall('cordova-ios', tmpDir, opts))
            .then(_ => expectDevDependenciesToBe({}))
            .then(_ => expectNotToBeInstalled('cordova-ios'))

            // git branch
            .then(_ => fetchAndMatch('https://github.com/apache/cordova-android.git#4.1.x', {
                name: 'cordova-android',
                version: '4.1.1'
            }))
            .then(_ => expectDevDependenciesToBe({ 'cordova-android': jasmine.stringMatching('#4.1.x') }))
            .then(_ => uninstall('cordova-android', tmpDir, opts));
    }, 150000);

    it('should fetch and uninstall a cordova plugin via git commit sha', () => {
        const SHA = '7db612115755c2be73a98dda76ff4c5fd9d8a575';
        const URL = `https://github.com/apache/cordova-plugin-contacts.git#${SHA}`;
        return Promise.resolve()
            .then(_ => fetchAndMatch(URL, {
                name: 'cordova-plugin-contacts',
                version: '2.0.2-dev'
            }))
            .then(_ => expectDevDependenciesToBe({ 'cordova-plugin-contacts': jasmine.stringMatching(`#${SHA}`) }))
            .then(_ => uninstall('cordova-plugin-contacts', tmpDir, opts))
            .then(_ => expectDevDependenciesToBe({}))
            .then(_ => expectNotToBeInstalled('cordova-plugin-contacts'));
    }, 30000);
});

describe('fetching already installed packages', () => {
    beforeEach(() => {
        fs.cpSync(path.join(__dirname, 'support'), 'support', { recursive: true });
    });

    it('should return package path for registry packages', () => {
        return Promise.resolve()
            .then(_ => fetchAndMatch('cordova-plugin-device'))
            .then(_ => fetchAndMatch('cordova-plugin-device'));
    }, 40000);

    it('should return package path if git repo name differs from plugin id', () => {
        const TARGET = `git+file://${path.resolve(__dirname, 'support/repo-name-neq-plugin-id.git')}`;
        return Promise.resolve()
            .then(_ => fetchAndMatch(TARGET, { name: 'test-plugin' }))
            .then(_ => fetchAndMatch(TARGET, { name: 'test-plugin' }));
    }, 40000);

    it('should return package path if using a relative path', () => {
        const TARGET = 'file:support/dummy-local-plugin';
        return Promise.resolve()
            .then(_ => fetchAndMatch(TARGET, { name: 'test-plugin' }))
            .then(_ => fetchAndMatch(TARGET, { name: 'test-plugin' }));
    }, 60000);

    it('should return package path for git+http variants', () => {
        return Promise.resolve()
            .then(_ => fetchAndMatch('github:apache/cordova-plugin-device', { name: 'cordova-plugin-device' }))
            .then(_ => fetchAndMatch('https://github.com/apache/cordova-plugin-device', { name: 'cordova-plugin-device' }))
            .then(_ => fetchAndMatch('git+https://github.com/apache/cordova-plugin-device', { name: 'cordova-plugin-device' }));
    }, 60000);
});

describe('negative tests', () => {
    it('should fail fetching a module that does not exist on npm', () => {
        return expectAsync(
            fetch('NOTAMODULE', tmpDir, opts)
        ).toBeRejectedWithError();
    }, 30000);

    it('should fail fetching a giturl which contains a subdirectory', () => {
        return expectAsync(
            fetch('https://github.com/apache/cordova-plugins.git#:keyboard', tmpDir, opts)
        ).toBeRejectedWithError();
    }, 30000);
});

describe('fetching with node_modules in ancestor dirs', () => {
    let fetchTarget, fetchDestination;

    beforeEach(() => {
        const testRoot = path.join(tmpDir, 'test-root');
        fetchDestination = path.join(testRoot, 'fetch-dest');
        fs.mkdirSync(fetchDestination, { recursive: true });

        // Make test root look like a package root directory
        fs.mkdirSync(path.join(testRoot, 'node_modules'), { recursive: true });
        fs.writeFileSync(path.join(testRoot, 'package.json'), JSON.stringify({ private: true }, null, 2), 'utf8');

        // Copy test fixtures to avoid linking out of temp directory
        fs.cpSync(path.join(__dirname, 'support'), 'support', { recursive: true });
        fetchTarget = `file://${path.resolve('support/dummy-local-plugin')}`;
    });

    it('should still install to given destination', () => {
        const expectedInstallPath = path.join(fetchDestination, 'node_modules/test-plugin');

        return fetch(fetchTarget, fetchDestination).then(pkgInstallPath => {
            expect(pkgInstallPath).toBe(expectedInstallPath);
        });
    }, 10 * 1000);
});
