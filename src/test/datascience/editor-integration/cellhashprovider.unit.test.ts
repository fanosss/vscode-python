// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { assert } from 'chai';
import * as TypeMoq from 'typemoq';
import { Position, Range } from 'vscode';

import { IConfigurationService, IDataScienceSettings, IPythonSettings } from '../../../client/common/types';
import { CellHashProvider } from '../../../client/datascience/editor-integration/cellhashprovider';
import { InteractiveWindowMessages, SysInfoReason } from '../../../client/datascience/interactive-window/interactiveWindowTypes';
import { MockDocumentManager } from '../mockDocumentManager';

// tslint:disable-next-line: max-func-body-length
suite('CellHashProvider Unit Tests', () => {
    let hashProvider: CellHashProvider;
    let documentManager: MockDocumentManager;
    let configurationService: TypeMoq.IMock<IConfigurationService>;
    let dataScienceSettings: TypeMoq.IMock<IDataScienceSettings>;
    let pythonSettings: TypeMoq.IMock<IPythonSettings>;

    setup(() => {
        configurationService = TypeMoq.Mock.ofType<IConfigurationService>();
        pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();
        dataScienceSettings = TypeMoq.Mock.ofType<IDataScienceSettings>();
        dataScienceSettings.setup(d => d.enabled).returns(() => true);
        pythonSettings.setup(p => p.datascience).returns(() => dataScienceSettings.object);
        configurationService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);
        documentManager = new MockDocumentManager();
        hashProvider = new CellHashProvider(documentManager, configurationService.object);
    });

    function addSingleChange(file: string, range: Range, newText: string) {
        documentManager.changeDocument(file, [{ range, newText }]);
    }

    test('Add a cell and edit it', () => {
        const file = '#%%\r\nprint("foo")\r\n#%%\r\nprint("bar")';
        const code = '#%%\r\nprint("bar")';
        // Create our document
        documentManager.addDocument(file, 'foo.py');

        // Add this code
        hashProvider.onMessage(InteractiveWindowMessages.RemoteAddCode, { code, file: 'foo.py', line: 2 });

        // We should have a single hash
        let hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 3, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');

        // Edit the first cell, removing it
        addSingleChange('foo.py', new Range(new Position(0, 0), new Position(1, 14)), '');

        // Get our hashes again. The line number should change
        // We should have a single hash
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 1, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 2, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');

    });

    test('Add a cell, delete it, and recreate it', () => {
        const file = '#%%\r\nprint("foo")\r\n#%%\r\nprint("bar")';
        const code = '#%%\r\nprint("bar")';
        // Create our document
        documentManager.addDocument(file, 'foo.py');

        // Add this code
        hashProvider.onMessage(InteractiveWindowMessages.RemoteAddCode, { code, file: 'foo.py', line: 2 });

        // We should have a single hash
        let hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 3, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');

        // Change the second cell
        addSingleChange('foo.py', new Range(new Position(3, 0), new Position(3, 0)), 'print ("bob")\r\n');

        // Should be no hashes now
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 0, 'Hash should be gone');

        // Undo the last change
        addSingleChange('foo.py', new Range(new Position(3, 0), new Position(3, 15)), '');

        // Hash should reappear
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 3, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');
    });

    test('Delete code below', () => {
        const file = '#%%\r\nprint("foo")\r\n#%%\r\nprint("bar")\r\n#%%\r\nprint("baz")';
        const code = '#%%\r\nprint("bar")';
        // Create our document
        documentManager.addDocument(file, 'foo.py');

        // Add this code
        hashProvider.onMessage(InteractiveWindowMessages.RemoteAddCode, { code, file: 'foo.py', line: 2 });

        // We should have a single hash
        let hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 3, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');

        // Change the third cell
        addSingleChange('foo.py', new Range(new Position(5, 0), new Position(5, 0)), 'print ("bob")\r\n');

        // Should be the same hashes
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 3, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');

        // Delete the first cell
        addSingleChange('foo.py', new Range(new Position(0, 0), new Position(1, 14)), '');

        // Hash should move
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 1, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 2, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');
    });

    test('Modify code after sending twice', () => {
        const file = '#%%\r\nprint("foo")\r\n#%%\r\nprint("bar")\r\n#%%\r\nprint("baz")';
        const code = '#%%\r\nprint("bar")';
        const thirdCell = '#%%\r\nprint ("bob")\r\nprint("baz")';
        // Create our document
        documentManager.addDocument(file, 'foo.py');

        // Add this code
        hashProvider.onMessage(InteractiveWindowMessages.RemoteAddCode, { code, file: 'foo.py', line: 2 });

        // We should have a single hash
        let hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 3, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');

        // Change the third cell
        addSingleChange('foo.py', new Range(new Position(5, 0), new Position(5, 0)), 'print ("bob")\r\n');

        // Send the third cell
        hashProvider.onMessage(InteractiveWindowMessages.RemoteAddCode, { code: thirdCell, file: 'foo.py', line: 4 });

        // Should be two hashes
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 2, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 3, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');
        assert.equal(hashes[0].hashes[1].line, 5, 'Wrong start line');
        assert.equal(hashes[0].hashes[1].endLine, 7, 'Wrong end line');
        assert.equal(hashes[0].hashes[1].executionCount, 2, 'Wrong execution count');

        // Delete the first cell
        addSingleChange('foo.py', new Range(new Position(0, 0), new Position(1, 14)), '');

        // Hashes should move
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 2, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 1, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 2, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');
        assert.equal(hashes[0].hashes[1].line, 3, 'Wrong start line');
        assert.equal(hashes[0].hashes[1].endLine, 5, 'Wrong end line');
        assert.equal(hashes[0].hashes[1].executionCount, 2, 'Wrong execution count');
    });

    test('Run same cell twice', () => {
        const file = '#%%\r\nprint("foo")\r\n#%%\r\nprint("bar")\r\n#%%\r\nprint("baz")';
        const code = '#%%\r\nprint("bar")';
        const thirdCell = '#%%\r\nprint ("bob")\r\nprint("baz")';

        // Create our document
        documentManager.addDocument(file, 'foo.py');

        // Add this code
        hashProvider.onMessage(InteractiveWindowMessages.RemoteAddCode, { code, file: 'foo.py', line: 2 });

        // Add a second cell
        hashProvider.onMessage(InteractiveWindowMessages.RemoteAddCode, { code: thirdCell, file: 'foo.py', line: 4 });

        // Add this code a second time
        hashProvider.onMessage(InteractiveWindowMessages.RemoteAddCode, { code, file: 'foo.py', line: 2 });

        // Execution count should go up, but still only have two cells.
        const hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 2, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 3, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 3, 'Wrong execution count');
        assert.equal(hashes[0].hashes[1].line, 5, 'Wrong start line');
        assert.equal(hashes[0].hashes[1].endLine, 7, 'Wrong end line');
        assert.equal(hashes[0].hashes[1].executionCount, 2, 'Wrong execution count');
    });

    test('Two files with same cells', () => {
        const file1 = '#%%\r\nprint("foo")\r\n#%%\r\nprint("bar")\r\n#%%\r\nprint("baz")';
        const file2 = file1;
        const code = '#%%\r\nprint("bar")';
        const thirdCell = '#%%\r\nprint ("bob")\r\nprint("baz")';

        // Create our documents
        documentManager.addDocument(file1, 'foo.py');
        documentManager.addDocument(file2, 'bar.py');

        // Add this code
        hashProvider.onMessage(InteractiveWindowMessages.RemoteAddCode, { code, file: 'foo.py', line: 2 });
        hashProvider.onMessage(InteractiveWindowMessages.RemoteAddCode, { code, file: 'bar.py', line: 2 });

        // Add a second cell
        hashProvider.onMessage(InteractiveWindowMessages.RemoteAddCode, { code: thirdCell, file: 'foo.py', line: 4 });

        // Add this code a second time
        hashProvider.onMessage(InteractiveWindowMessages.RemoteAddCode, { code, file: 'foo.py', line: 2 });

        // Execution count should go up, but still only have two cells.
        const hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 2, 'Wrong number of hashes');
        const fooHash = hashes.find(h => h.file === 'foo.py');
        const barHash = hashes.find(h => h.file === 'bar.py');
        assert.ok(fooHash, 'No hash for foo.py');
        assert.ok(barHash, 'No hash for bar.py');
        assert.equal(fooHash!.hashes.length, 2, 'Not enough hashes found');
        assert.equal(fooHash!.hashes[0].line, 3, 'Wrong start line');
        assert.equal(fooHash!.hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(fooHash!.hashes[0].executionCount, 4, 'Wrong execution count');
        assert.equal(fooHash!.hashes[1].line, 5, 'Wrong start line');
        assert.equal(fooHash!.hashes[1].endLine, 7, 'Wrong end line');
        assert.equal(fooHash!.hashes[1].executionCount, 3, 'Wrong execution count');
        assert.equal(barHash!.hashes.length, 1, 'Not enough hashes found');
        assert.equal(barHash!.hashes[0].line, 3, 'Wrong start line');
        assert.equal(barHash!.hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(barHash!.hashes[0].executionCount, 2, 'Wrong execution count');
    });

    test('Delete cell with dupes in code, put cell back', () => {
        const file = '#%%\r\nprint("foo")\r\n#%%\r\nprint("foo")\r\n#%%\r\nprint("bar")\r\n#%%\r\nprint("baz")';
        const code = '#%%\r\nprint("foo")';

        // Create our document
        documentManager.addDocument(file, 'foo.py');

        // Add this code
        hashProvider.onMessage(InteractiveWindowMessages.RemoteAddCode, { code, file: 'foo.py', line: 2 });

        // We should have a single hash
        let hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 3, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');

        // Modify the code
        addSingleChange('foo.py', new Range(new Position(3, 0), new Position(3, 1)), '');

        // Should have zero hashes
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 0, 'Too many hashes found');

        // Put back the original cell
        addSingleChange('foo.py', new Range(new Position(3, 0), new Position(3, 0)), 'p');
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 3, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');

        // Modify the code
        addSingleChange('foo.py', new Range(new Position(3, 0), new Position(3, 1)), '');
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 0, 'Too many hashes found');

        // Remove the first cell
        addSingleChange('foo.py', new Range(new Position(0, 0), new Position(1, 14)), '');
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 0, 'Too many hashes found');

        // Put back the original cell
        addSingleChange('foo.py', new Range(new Position(1, 0), new Position(1, 0)), 'p');
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 1, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 2, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');
    });

    test('Add a cell and edit different parts of it', () => {
        const file = '#%%\r\nprint("foo")\r\n#%%\r\nprint("bar")';
        const code = '#%%\r\nprint("bar")';
        // Create our document
        documentManager.addDocument(file, 'foo.py');

        // Add this code
        hashProvider.onMessage(InteractiveWindowMessages.RemoteAddCode, { code, file: 'foo.py', line: 2 });

        // We should have a single hash
        const hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 3, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');

        // Edit the cell we added
        addSingleChange('foo.py', new Range(new Position(2, 0), new Position(2, 0)), '#');
        assert.equal(hashProvider.getHashes().length, 0, 'Cell should be destroyed');
        addSingleChange('foo.py', new Range(new Position(2, 0), new Position(2, 1)), '');
        assert.equal(hashProvider.getHashes().length, 1, 'Cell should be back');
        addSingleChange('foo.py', new Range(new Position(2, 0), new Position(2, 1)), '');
        assert.equal(hashProvider.getHashes().length, 0, 'Cell should be destroyed');
        addSingleChange('foo.py', new Range(new Position(2, 0), new Position(2, 0)), '#');
        assert.equal(hashProvider.getHashes().length, 1, 'Cell should be back');
        addSingleChange('foo.py', new Range(new Position(2, 1), new Position(2, 2)), '');
        assert.equal(hashProvider.getHashes().length, 0, 'Cell should be destroyed');
        addSingleChange('foo.py', new Range(new Position(2, 1), new Position(2, 1)), '%');
        assert.equal(hashProvider.getHashes().length, 1, 'Cell should be back');
        addSingleChange('foo.py', new Range(new Position(2, 2), new Position(2, 3)), '');
        assert.equal(hashProvider.getHashes().length, 0, 'Cell should be destroyed');
        addSingleChange('foo.py', new Range(new Position(2, 2), new Position(2, 2)), '%');
        assert.equal(hashProvider.getHashes().length, 1, 'Cell should be back');
        addSingleChange('foo.py', new Range(new Position(2, 3), new Position(2, 4)), '');
        assert.equal(hashProvider.getHashes().length, 0, 'Cell should be destroyed');
        addSingleChange('foo.py', new Range(new Position(2, 3), new Position(2, 3)), '\r');
        assert.equal(hashProvider.getHashes().length, 1, 'Cell should be back');
        addSingleChange('foo.py', new Range(new Position(2, 4), new Position(2, 5)), '');
        assert.equal(hashProvider.getHashes().length, 0, 'Cell should be destroyed');
        addSingleChange('foo.py', new Range(new Position(2, 4), new Position(2, 4)), '\n');
        assert.equal(hashProvider.getHashes().length, 1, 'Cell should be back');
    });

    test('Add a cell and edit it to be exactly the same', () => {
        const file = '#%%\r\nprint("foo")\r\n#%%\r\nprint("bar")';
        const code = '#%%\r\nprint("bar")';
        // Create our document
        documentManager.addDocument(file, 'foo.py');

        // Add this code
        hashProvider.onMessage(InteractiveWindowMessages.RemoteAddCode, { code, file: 'foo.py', line: 2 });

        // We should have a single hash
        let hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 3, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');

        // Replace with the same cell
        addSingleChange('foo.py', new Range(new Position(0, 0), new Position(3, 14)), file);
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 3, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');
        assert.equal(hashProvider.getHashes().length, 1, 'Cell should be back');
    });

    test('Add a cell and edit it to not be exactly the same', () => {
        const file = '#%%\r\nprint("foo")\r\n#%%\r\nprint("bar")';
        const file2 = '#%%\r\nprint("fooze")\r\n#%%\r\nprint("bar")';
        const code = '#%%\r\nprint("bar")';
        // Create our document
        documentManager.addDocument(file, 'foo.py');

        // Add this code
        hashProvider.onMessage(InteractiveWindowMessages.RemoteAddCode, { code, file: 'foo.py', line: 2 });

        // We should have a single hash
        let hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 3, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');

        // Replace with the new code
        addSingleChange('foo.py', new Range(new Position(0, 0), new Position(3, 14)), file2);
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 0, 'Hashes should be gone');

        // Put back old code
        addSingleChange('foo.py', new Range(new Position(0, 0), new Position(3, 14)), file);
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 3, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');
    });

    test('Apply multiple edits at once', () => {
        const file = '#%%\r\nprint("foo")\r\n#%%\r\nprint("bar")';
        const code = '#%%\r\nprint("bar")';
        // Create our document
        documentManager.addDocument(file, 'foo.py');

        // Add this code
        hashProvider.onMessage(InteractiveWindowMessages.RemoteAddCode, { code, file: 'foo.py', line: 2 });

        // We should have a single hash
        let hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 3, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');

        // Apply a couple of edits at once
        documentManager.changeDocument('foo.py',
        [
            {
                range: new Range(new Position(0, 0), new Position(0, 0)),
                newText: '#%%\r\nprint("new cell")\r\n'
            },
            {
                range: new Range(new Position(0, 0), new Position(0, 0)),
                newText: '#%%\r\nprint("new cell")\r\n'
            }
        ]);
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 7, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 8, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');

        documentManager.changeDocument('foo.py',
        [
            {
                range: new Range(new Position(0, 0), new Position(0, 0)),
                newText: '#%%\r\nprint("new cell")\r\n'
            },
            {
                range: new Range(new Position(0, 0), new Position(1, 19)),
                newText: ''
            }
        ]);
        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 7, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 8, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');

    });

    test('Restart kernel', () => {
        const file = '#%%\r\nprint("foo")\r\n#%%\r\nprint("bar")';
        const code = '#%%\r\nprint("bar")';
        // Create our document
        documentManager.addDocument(file, 'foo.py');

        // Add this code
        hashProvider.onMessage(InteractiveWindowMessages.RemoteAddCode, { code, file: 'foo.py', line: 2 });

        // We should have a single hash
        let hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 3, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');

        // Restart the kernel
        hashProvider.onMessage(InteractiveWindowMessages.AddedSysInfo, { type: SysInfoReason.Restart });

        hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 0, 'Restart should have cleared');
    });

    test('More than one cell in range', () => {
        const file = '#%%\r\nprint("foo")\r\n#%%\r\nprint("bar")';
        // Create our document
        documentManager.addDocument(file, 'foo.py');

        // Add this code
        hashProvider.onMessage(InteractiveWindowMessages.RemoteAddCode, { code: file, file: 'foo.py', line: 0 });

        // We should have a single hash
        const hashes = hashProvider.getHashes();
        assert.equal(hashes.length, 1, 'No hashes found');
        assert.equal(hashes[0].hashes.length, 1, 'Not enough hashes found');
        assert.equal(hashes[0].hashes[0].line, 1, 'Wrong start line');
        assert.equal(hashes[0].hashes[0].endLine, 4, 'Wrong end line');
        assert.equal(hashes[0].hashes[0].executionCount, 1, 'Wrong execution count');
    });
});
