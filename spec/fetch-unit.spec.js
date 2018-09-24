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

const fs = require('fs-extra');
const path = require('path');
const rewire = require('rewire');
const { tmpDir: getTmpDir } = require('./helpers.js');

describe('fetch', function () {
    let fetch, installPackage;

    beforeEach(function () {
        fetch = rewire('..');
        installPackage = jasmine.createSpy()
            .and.returnValue(Promise.resolve('/foo'));
        fetch.__set__({ fs: { ensureDirSync: _ => _ }, installPackage });
    });

    it('should return path to installed package', function () {
        fetch.__set__({ pathToInstalledPackage: _ => Promise.resolve('/foo') });

        return fetch('foo', 'bar').then(result => {
            expect(result).toBe('/foo');
            expect(installPackage).not.toHaveBeenCalled();
        });
    });

    it('should install package if not found', function () {
        fetch.__set__({ pathToInstalledPackage: _ => Promise.reject() });

        return fetch('foo', 'bar').then(result => {
            expect(result).toBe('/foo');
            expect(installPackage).toHaveBeenCalled();
        });
    });
});

describe('npmArgs', function () {
    const fetch = rewire('..');
    const npmArgs = fetch.__get__('npmArgs');

    it('should handle missing options', function () {
        npmArgs('platform');
    });

    it('npm install should be called with production flag (default)', function () {
        var opts = { cwd: 'some/path', production: true, save: true };
        expect(npmArgs('platform', opts)).toContain('--production');
    });

    it('save-exact should be true if passed in', function () {
        var opts = { cwd: 'some/path', save_exact: true };
        expect(npmArgs('platform', opts)).toContain('--save-exact');
    });

    it('noprod should turn production off', function () {
        var opts = { cwd: 'some/path', production: false };
        expect(npmArgs('platform', opts)).not.toContain('--production');
    });

    it('when save is false, no-save flag should be passed through', function () {
        var opts = { cwd: 'some/path', production: true, save: false };
        expect(npmArgs('platform', opts)).toContain('--no-save');
    });
});

describe('pathToInstalledPackage', function () {
    let tmpDir, pathToInstalledPackage, expectedPath;

    beforeEach(function () {
        tmpDir = getTmpDir();

        pathToInstalledPackage = rewire('..').__get__('pathToInstalledPackage');

        fs.mkdirpSync(path.join(tmpDir, 'app', 'node_modules'));

        expectedPath = path.join(tmpDir, 'app', 'node_modules', 'dummy-local-plugin');
        fs.copySync(path.join(__dirname, 'support', 'dummy-local-plugin'), expectedPath);

        fs.mkdirpSync(path.join(tmpDir, 'app', 'nested-directory', 'nested-subdirectory'));

        fs.mkdirSync(path.join(tmpDir, 'another-app'));
    });

    afterEach(function () {
        fs.removeSync(tmpDir);
    });

    function pathToInstalledPackageAndMatch (dest) {
        return pathToInstalledPackage('dummy-local-plugin', dest)
            .then(p => expect(p).toEqual(expectedPath));
    }

    it('should find a package installed in the given directory', function () {
        return pathToInstalledPackageAndMatch(path.join(tmpDir, 'app'));
    });

    it('should find a package installed in the parent of the given directory', function () {
        return pathToInstalledPackageAndMatch(path.join(tmpDir, 'app', 'nested-directory'));
    });

    it('should find a package installed in an ancestor of the given directory', function () {
        return pathToInstalledPackageAndMatch(path.join(tmpDir, 'app', 'nested-directory', 'nested-subdirectory'));
    });

    it('should not find a package installed elsewhere', function () {
        return pathToInstalledPackage('dummy-local-plugin')
            .then(_ => fail('expect promise to be rejected'))
            .catch(err => expect(err).toBeDefined());
    });

    it('should find a package installed at $NODE_PATH', function () {
        process.env.NODE_PATH = path.join(tmpDir, 'app', 'node_modules');
        return pathToInstalledPackageAndMatch(path.join(tmpDir, 'another-app'));
    });
});
