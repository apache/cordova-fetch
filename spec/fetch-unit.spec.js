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

const rewire = require('rewire');

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

describe('more unit tests for index.js: internal getPath() call', function () {
    beforeEach(function () {
        spyOn(superspawn, 'spawn').and.returnValue(Promise.resolve('+ my-repo@2.0.0'));
        spyOn(shell, 'mkdir').and.returnValue(true);
        spyOn(shell, 'which').and.returnValue(Q());
        spyOn(fetch, 'isNpmInstalled').and.returnValue(Q());
        spyOn(fetch, 'getPath').and.returnValue('some/path/to/my-repo');
        spyOn(fs, 'existsSync').and.returnValue(false);
    });

    it('internal getPath to be called with correct arguments for: https://scm.service.io/user/my-repo', function () {
        var opts = { cwd: 'some/path', production: true, save: true };
        var url = 'https://scm.service.io/user/my-repo';
        return fetch(url, 'tmpDir', opts)
            .then(function (result) {
                expect(fetch.getPath).toHaveBeenCalledWith('my-repo', jasmine.stringMatching(/node_modules$/), url);
                expect(result).toBe('some/path/to/my-repo');
            });
    });

    it('internal getPath to be called with correct arguments for: git://scm.service.io/user/my-repo', function () {
        var opts = { cwd: 'some/path', production: true, save: true };
        var url = 'git://scm.service.io/user/my-repo';
        return fetch(url, 'tmpDir', opts)
            .then(function (result) {
                expect(fetch.getPath).toHaveBeenCalledWith('my-repo', jasmine.stringMatching(/node_modules$/), url);
                expect(result).toBe('some/path/to/my-repo');
            });
    });

    it('internal getPath to be called with correct arguments for: git+http://scm.service.io/user/my-repo://scm.service.io/user/my-repo', function () {
        var opts = { cwd: 'some/path', production: true, save: true };
        var url = 'git+http://scm.service.io/user/my-repo://scm.service.io/user/my-repo';
        return fetch(url, 'tmpDir', opts)
            .then(function (result) {
                expect(fetch.getPath).toHaveBeenCalledWith('my-repo', jasmine.stringMatching(/node_modules$/), url);
                expect(result).toBe('some/path/to/my-repo');
            });
    });

    it('internal getPath to be called with correct arguments for: git+https://scm.service.io/user/my-repo://scm.service.io/user/my-repo', function () {
        var opts = { cwd: 'some/path', production: true, save: true };
        var url = 'git+https://scm.service.io/user/my-repo://scm.service.io/user/my-repo';
        return fetch(url, 'tmpDir', opts)
            .then(function (result) {
                expect(fetch.getPath).toHaveBeenCalledWith('my-repo', jasmine.stringMatching(/node_modules$/), url);
                expect(result).toBe('some/path/to/my-repo');
            });
    });

    it('internal getPath to be called with correct arguments for: file://my/path/to/my-repo', function () {
        var opts = { cwd: 'some/path', production: true, save: true };
        var url = 'file://my/path/to/my-repo';
        return fetch(url, 'tmpDir', opts)
            .then(function (result) {
                expect(fetch.getPath).toHaveBeenCalledWith('my-repo', jasmine.stringMatching(/node_modules$/), url);
                expect(result).toBe('some/path/to/my-repo');
            });
    });

    it('internal getPath to be called with correct arguments for: /my/path/to/my-repo', function () {
        var opts = { cwd: 'some/path', production: true, save: true };
        var url = '/my/path/to/my-repo';
        return fetch(url, 'tmpDir', opts)
            .then(function (result) {
                expect(fetch.getPath).toHaveBeenCalledWith('my-repo', jasmine.stringMatching(/node_modules$/), url);
                expect(result).toBe('some/path/to/my-repo');
            });
    });

    it('internal getPath to be called with correct arguments for: https://scm.service.io/user/my-repo#old-tag', function () {
        var opts = { cwd: 'some/path', production: true, save: true };
        var url = 'https://scm.service.io/user/my-repo#old-tag';
        return fetch(url, 'tmpDir', opts)
            .then(function (result) {
                expect(fetch.getPath).toHaveBeenCalledWith('my-repo', jasmine.stringMatching(/node_modules$/), url);
                expect(result).toBe('some/path/to/my-repo');
            });
    });

    it('internal getPath to be called with correct arguments for: git://scm.service.io/user/my-repo#old-tag', function () {
        var opts = { cwd: 'some/path', production: true, save: true };
        var url = 'git://scm.service.io/user/my-repo#old-tag';
        return fetch(url, 'tmpDir', opts)
            .then(function (result) {
                expect(fetch.getPath).toHaveBeenCalledWith('my-repo', jasmine.stringMatching(/node_modules$/), url);
                expect(result).toBe('some/path/to/my-repo');
            });
    });

    it('internal getPath to be called with correct arguments for: git+http://scm.service.io/user/my-repo#old-tag', function () {
        var opts = { cwd: 'some/path', production: true, save: true };
        var url = 'git+http://scm.service.io/user/my-repo#old-tag';
        return fetch(url, 'tmpDir', opts)
            .then(function (result) {
                expect(fetch.getPath).toHaveBeenCalledWith('my-repo', jasmine.stringMatching(/node_modules$/), url);
                expect(result).toBe('some/path/to/my-repo');
            });
    });

    it('internal getPath to be called with correct arguments for: git+https://scm.service.io/user/my-repo#old-tag', function () {
        var opts = { cwd: 'some/path', production: true, save: true };
        var url = 'git+https://scm.service.io/user/my-repo#old-tag';
        return fetch(url, 'tmpDir', opts)
            .then(function (result) {
                expect(fetch.getPath).toHaveBeenCalledWith('my-repo', jasmine.stringMatching(/node_modules$/), url);
                expect(result).toBe('some/path/to/my-repo');
            });
    });

    it('internal getPath to be called with correct arguments for: https://scm.service.io/user/my-repo.git', function () {
        var opts = { cwd: 'some/path', production: true, save: true };
        var url = 'https://scm.service.io/user/my-repo.git';
        return fetch(url, 'tmpDir', opts)
            .then(function (result) {
                expect(fetch.getPath).toHaveBeenCalledWith('my-repo', jasmine.stringMatching(/node_modules$/), url);
                expect(result).toBe('some/path/to/my-repo');
            });
    });

    it('internal getPath to be called with correct arguments for: git://scm.service.io/user/my-repo.git', function () {
        var opts = { cwd: 'some/path', production: true, save: true };
        var url = 'git://scm.service.io/user/my-repo.git';
        return fetch(url, 'tmpDir', opts)
            .then(function (result) {
                expect(fetch.getPath).toHaveBeenCalledWith('my-repo', jasmine.stringMatching(/node_modules$/), url);
                expect(result).toBe('some/path/to/my-repo');
            });
    });

    it('internal getPath to be called with correct arguments for: git+http://scm.service.io/user/my-repo.git', function () {
        var opts = { cwd: 'some/path', production: true, save: true };
        var url = 'git+http://scm.service.io/user/my-repo.git';
        return fetch(url, 'tmpDir', opts)
            .then(function (result) {
                expect(fetch.getPath).toHaveBeenCalledWith('my-repo', jasmine.stringMatching(/node_modules$/), url);
                expect(result).toBe('some/path/to/my-repo');
            });
    });

    it('internal getPath to be called with correct arguments for: git+https://scm.service.io/user/my-repo.git', function () {
        var opts = { cwd: 'some/path', production: true, save: true };
        var url = 'git+https://scm.service.io/user/my-repo.git';
        return fetch(url, 'tmpDir', opts)
            .then(function (result) {
                expect(fetch.getPath).toHaveBeenCalledWith('my-repo', jasmine.stringMatching(/node_modules$/), url);
                expect(result).toBe('some/path/to/my-repo');
            });
    });

    it('internal getPath to be called with correct arguments for: https://scm.service.io/user/my-repo.git#old-tag', function () {
        var opts = { cwd: 'some/path', production: true, save: true };
        var url = 'https://scm.service.io/user/my-repo.git#old-tag';
        return fetch(url, 'tmpDir', opts)
            .then(function (result) {
                expect(fetch.getPath).toHaveBeenCalledWith('my-repo', jasmine.stringMatching(/node_modules$/), url);
                expect(result).toBe('some/path/to/my-repo');
            });
    });

    it('internal getPath to be called with correct arguments for: git://scm.service.io/user/my-repo.git#old-tag', function () {
        var opts = { cwd: 'some/path', production: true, save: true };
        var url = 'git://scm.service.io/user/my-repo.git#old-tag';
        return fetch(url, 'tmpDir', opts)
            .then(function (result) {
                expect(fetch.getPath).toHaveBeenCalledWith('my-repo', jasmine.stringMatching(/node_modules$/), url);
                expect(result).toBe('some/path/to/my-repo');
            });
    });

    it('internal getPath to be called with correct arguments for: git+http://scm.service.io/user/my-repo.git#old-tag', function () {
        var opts = { cwd: 'some/path', production: true, save: true };
        var url = 'git+http://scm.service.io/user/my-repo.git#old-tag';
        return fetch(url, 'tmpDir', opts)
            .then(function (result) {
                expect(fetch.getPath).toHaveBeenCalledWith('my-repo', jasmine.stringMatching(/node_modules$/), url);
                expect(result).toBe('some/path/to/my-repo');
            });
    });

    it('internal getPath to be called with correct arguments for: git+https://scm.service.io/user/my-repo.git#old-tag', function () {
        var opts = { cwd: 'some/path', production: true, save: true };
        var url = 'git+https://scm.service.io/user/my-repo.git#old-tag';
        return fetch(url, 'tmpDir', opts)
            .then(function (result) {
                expect(fetch.getPath).toHaveBeenCalledWith('my-repo', jasmine.stringMatching(/node_modules$/), url);
                expect(result).toBe('some/path/to/my-repo');
            });
    });

    it('internal getPath to be called with correct arguments for: https://scm.git.service.io/user/my-repo.git', function () {
        var opts = { cwd: 'some/path', production: true, save: true };
        var url = 'https://scm.git.service.io/user/my-repo.git';
        return fetch(url, 'tmpDir', opts)
            .then(function (result) {
                expect(fetch.getPath).toHaveBeenCalledWith('my-repo', jasmine.stringMatching(/node_modules$/), url);
                expect(result).toBe('some/path/to/my-repo');
            });
    });

    it('internal getPath to be called with correct arguments for: git://scm.git.service.io/user/my-repo.git', function () {
        var opts = { cwd: 'some/path', production: true, save: true };
        var url = 'git://scm.git.service.io/user/my-repo.git';
        return fetch(url, 'tmpDir', opts)
            .then(function (result) {
                expect(fetch.getPath).toHaveBeenCalledWith('my-repo', jasmine.stringMatching(/node_modules$/), url);
                expect(result).toBe('some/path/to/my-repo');
            });
    });

    it('internal getPath to be called with correct arguments for: git+http://scm.git.service.io/user/my-repo.git', function () {
        var opts = { cwd: 'some/path', production: true, save: true };
        var url = 'git+http://scm.git.service.io/user/my-repo.git';
        return fetch(url, 'tmpDir', opts)
            .then(function (result) {
                expect(fetch.getPath).toHaveBeenCalledWith('my-repo', jasmine.stringMatching(/node_modules$/), url);
                expect(result).toBe('some/path/to/my-repo');
            });
    });

    it('internal getPath to be called with correct arguments for: git+https://scm.git.service.io/user/my-repo.git', function () {
        var opts = { cwd: 'some/path', production: true, save: true };
        var url = 'git+https://scm.git.service.io/user/my-repo.git';
        return fetch(url, 'tmpDir', opts)
            .then(function (result) {
                expect(fetch.getPath).toHaveBeenCalledWith('my-repo', jasmine.stringMatching(/node_modules$/), url);
                expect(result).toBe('some/path/to/my-repo');
            });
    });

    it('internal getPath to be called with correct arguments for: https://scm.git.service.io/user/my-repo.git#old-tag', function () {
        var opts = { cwd: 'some/path', production: true, save: true };
        var url = 'https://scm.git.service.io/user/my-repo.git#old-tag';
        return fetch(url, 'tmpDir', opts)
            .then(function (result) {
                expect(fetch.getPath).toHaveBeenCalledWith('my-repo', jasmine.stringMatching(/node_modules$/), url);
                expect(result).toBe('some/path/to/my-repo');
            });
    });

    it('internal getPath to be called with correct arguments for: git://scm.git.service.io/user/my-repo.git#old-tag', function () {
        var opts = { cwd: 'some/path', production: true, save: true };
        var url = 'git://scm.git.service.io/user/my-repo.git#old-tag';
        return fetch(url, 'tmpDir', opts)
            .then(function (result) {
                expect(fetch.getPath).toHaveBeenCalledWith('my-repo', jasmine.stringMatching(/node_modules$/), url);
                expect(result).toBe('some/path/to/my-repo');
            });
    });

    it('internal getPath to be called with correct arguments for: git+http://scm.git.service.io/user/my-repo.git#old-tag', function () {
        var opts = { cwd: 'some/path', production: true, save: true };
        var url = 'git+http://scm.git.service.io/user/my-repo.git#old-tag';
        return fetch(url, 'tmpDir', opts)
            .then(function (result) {
                expect(fetch.getPath).toHaveBeenCalledWith('my-repo', jasmine.stringMatching(/node_modules$/), url);
                expect(result).toBe('some/path/to/my-repo');
            });
    });

    it('internal getPath to be called with correct arguments for: git+https://scm.git.service.io/user/my-repo.git#old-tag', function () {
        var opts = { cwd: 'some/path', production: true, save: true };
        var url = 'git+https://scm.git.service.io/user/my-repo.git#old-tag';
        return fetch(url, 'tmpDir', opts)
            .then(function (result) {
                expect(fetch.getPath).toHaveBeenCalledWith('my-repo', jasmine.stringMatching(/node_modules$/), url);
                expect(result).toBe('some/path/to/my-repo');
            });
    });

    it('internal getPath to be called with correct arguments for: https://scm.service.io/user/my-repo-other-url', function () {
        var opts = { cwd: 'some/path', production: true, save: true };
        var url = 'https://scm.service.io/user/my-repo-other-url';
        return fetch(url, 'tmpDir', opts)
            .then(function (result) {
                expect(fetch.getPath).toHaveBeenCalledWith('my-repo', jasmine.stringMatching(/node_modules$/), url);
                expect(result).toBe('some/path/to/my-repo');
            });
    });
});
