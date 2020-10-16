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

describe('npmArgs', () => {
    const fetch = rewire('..');
    const npmArgs = fetch.__get__('npmArgs');

    it('should handle missing options', () => {
        npmArgs('platform');
    });

    it('when save_exact is true, save-exact flag should be passed through to npm', () => {
        const opts = { cwd: 'some/path', save_exact: true };
        expect(npmArgs('platform', opts)).toContain('--save-exact');
    });

    it('when save is true, save-dev flag should be passed through to npm', () => {
        const opts = { cwd: 'some/path', save: true };
        expect(npmArgs('platform', opts)).toContain('--save-dev');
    });

    it('when save is false, no-save flag should be passed through to npm', () => {
        const opts = { cwd: 'some/path', save: false };
        expect(npmArgs('platform', opts)).toContain('--no-save');
    });
});

describe('resolvePathToPackage', () => {
    let tmpDir, resolvePathToPackage, expectedPath, NODE_PATH;

    beforeEach(() => {
        tmpDir = getTmpDir();
        resolvePathToPackage = rewire('..').__get__('resolvePathToPackage');
        expectedPath = path.join(tmpDir, 'app/node_modules/dummy-local-plugin');
        fs.copySync(path.join(__dirname, 'support/dummy-local-plugin'), expectedPath);

        NODE_PATH = process.env.NODE_PATH;
        delete process.env.NODE_PATH;
    });

    afterEach(() => {
        if (NODE_PATH !== undefined) {
            process.env.NODE_PATH = NODE_PATH;
        }
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

    it('should gracefully handle broken $NODE_PATH', () => {
        process.env.NODE_PATH = path.delimiter;
        return resolvePathToPackage('dummy-local-plugin', tmpDir).then(
            _ => fail('expect promise to be rejected'),
            err => expect(err).toBeDefined()
        );
    });
});
