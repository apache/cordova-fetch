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

describe('resolvePathToPackage', () => {
    let tmpDir, resolvePathToPackage, expectedPath;

    beforeEach(() => {
        tmpDir = getTmpDir();
        resolvePathToPackage = rewire('..').__get__('resolvePathToPackage');
        expectedPath = path.join(tmpDir, 'app/node_modules/dummy-local-plugin');
        fs.copySync(path.join(__dirname, 'support/dummy-local-plugin'), expectedPath);
    });

    afterEach(() => {
        fs.removeSync(tmpDir);
    });

    function resolveToExpectedPathFrom (basedir) {
        return Promise.resolve()
            .then(_ => fs.mkdirp(basedir))
            .then(_ => resolvePathToPackage('dummy-local-plugin', basedir))
            .then(([p]) => expect(p).toEqual(expectedPath));
    }

    it('should return path and package.json of an installed package', () => {
        return Promise.resolve(path.join(tmpDir, 'app'))
            .then(basedir => resolvePathToPackage('dummy-local-plugin', basedir))
            .then(([pkgPath, pkgJson]) => {
                expect(pkgPath).toEqual(expectedPath);
                expect(pkgJson).toEqual(jasmine.objectContaining({
                    name: 'test-plugin', version: '1.0.0'
                }));
            });
    });

    it('should find a package installed in the parent of the given directory', () => {
        return resolveToExpectedPathFrom(path.join(tmpDir, 'app/nested-directory'));
    });

    it('should find a package installed in an ancestor of the given directory', () => {
        return resolveToExpectedPathFrom(path.join(tmpDir, 'app/nested-directory/nested-subdirectory'));
    });

    it('should not find a package installed elsewhere', () => {
        return resolvePathToPackage('dummy-local-plugin', tmpDir).then(
            _ => fail('expect promise to be rejected'),
            err => expect(err).toBeDefined()
        );
    });

    it('should find a package installed at $NODE_PATH', () => {
        process.env.NODE_PATH = path.join(tmpDir, 'app/node_modules');
        return resolveToExpectedPathFrom(path.join(tmpDir, 'another-app'));
    });
});
