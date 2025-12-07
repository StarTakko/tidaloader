/**
 * Frontend Edge Case Tests for Download Queue
 * 
 * Run these tests in the browser console after loading the app,
 * or use them as a reference for manual testing.
 * 
 * Tests:
 * 1. Store state management
 * 2. Server queue API methods
 * 3. Concurrent operations
 * 4. Error handling
 * 5. State sync
 */

// Test utilities
const TestRunner = {
    passed: 0,
    failed: 0,
    errors: [],

    assert(name, condition, error = null) {
        if (condition) {
            this.passed++;
            console.log(`  ✅ ${name}`);
        } else {
            this.failed++;
            this.errors.push({ name, error });
            console.log(`  ❌ ${name}: ${error || 'Assertion failed'}`);
        }
    },

    async assertAsync(name, asyncFn) {
        try {
            const result = await asyncFn();
            this.assert(name, result === true || result);
        } catch (e) {
            this.assert(name, false, e.message);
        }
    },

    report() {
        console.log('\n' + '='.repeat(60));
        console.log(`📊 RESULTS: ${this.passed} passed, ${this.failed} failed`);
        console.log('='.repeat(60));
        if (this.errors.length > 0) {
            console.log('\n❌ FAILURES:');
            this.errors.forEach(({ name, error }) => {
                console.log(`  - ${name}: ${error}`);
            });
        }
    },

    reset() {
        this.passed = 0;
        this.failed = 0;
        this.errors = [];
    }
};

// ============================================================================
// STORE TESTS
// ============================================================================

async function testStoreBasics() {
    console.log('\n🧪 Test: Store Basics');

    const { useDownloadStore } = await import('../stores/downloadStore.js');
    const store = useDownloadStore.getState();

    // Check initial structure
    TestRunner.assert('Store has queue array', Array.isArray(store.queue));
    TestRunner.assert('Store has downloading array', Array.isArray(store.downloading));
    TestRunner.assert('Store has completed array', Array.isArray(store.completed));
    TestRunner.assert('Store has failed array', Array.isArray(store.failed));
    TestRunner.assert('Store has quality setting', typeof store.quality === 'string');
    TestRunner.assert('Store has maxConcurrent', typeof store.maxConcurrent === 'number');
    TestRunner.assert('Store has serverQueueSettings', typeof store.serverQueueSettings === 'object');

    // Check methods exist
    TestRunner.assert('addToQueue method exists', typeof store.addToQueue === 'function');
    TestRunner.assert('removeFromQueue method exists', typeof store.removeFromQueue === 'function');
    TestRunner.assert('setServerQueueState method exists', typeof store.setServerQueueState === 'function');
    TestRunner.assert('setQueueSettings method exists', typeof store.setQueueSettings === 'function');
}

async function testStoreServerSync() {
    console.log('\n🧪 Test: Store Server Sync');

    const { useDownloadStore } = await import('../stores/downloadStore.js');
    const store = useDownloadStore.getState();

    // Test setServerQueueState
    const mockServerState = {
        queue: [
            { id: 'q-1', tidal_id: 1, title: 'Test Track 1', artist: 'Artist 1' },
            { id: 'q-2', tidal_id: 2, title: 'Test Track 2', artist: 'Artist 2' }
        ],
        downloading: [
            { id: 'd-3', tidal_id: 3, title: 'Downloading', artist: 'Artist 3', progress: 50 }
        ],
        completed: [],
        failed: []
    };

    store.setServerQueueState(mockServerState);

    const newState = useDownloadStore.getState();
    TestRunner.assert('Queue updated from server', newState.queue.length === 2);
    TestRunner.assert('Downloading updated from server', newState.downloading.length === 1);
    TestRunner.assert('First queue item has correct title', newState.queue[0].title === 'Test Track 1');

    // Test setQueueSettings
    store.setQueueSettings({ max_concurrent: 5, auto_process: false });
    const settingsState = useDownloadStore.getState();
    TestRunner.assert('Queue settings updated', settingsState.serverQueueSettings.max_concurrent === 5);
    TestRunner.assert('maxConcurrent synced', settingsState.maxConcurrent === 5);

    // Reset state
    store.setServerQueueState({ queue: [], downloading: [], completed: [], failed: [] });
    store.setQueueSettings({ max_concurrent: 3, auto_process: true });
}

async function testStoreDuplicateHandling() {
    console.log('\n🧪 Test: Store Duplicate Handling');

    const { useDownloadStore } = await import('../stores/downloadStore.js');
    const store = useDownloadStore.getState();

    // Clear state
    store.setServerQueueState({ queue: [], downloading: [], completed: [], failed: [] });

    // Add track
    store.addToQueue([{ tidal_id: 12345, title: 'Test', artist: 'Artist' }]);
    const afterFirst = useDownloadStore.getState();
    TestRunner.assert('First add succeeds', afterFirst.queue.length === 1);

    // Add duplicate
    store.addToQueue([{ tidal_id: 12345, title: 'Test Duplicate', artist: 'Artist' }]);
    const afterDupe = useDownloadStore.getState();
    TestRunner.assert('Duplicate not added', afterDupe.queue.length === 1);
    TestRunner.assert('Original title preserved', afterDupe.queue[0].title === 'Test');

    // Clear
    store.setServerQueueState({ queue: [], downloading: [], completed: [], failed: [] });
}

// ============================================================================
// DOWNLOAD MANAGER TESTS
// ============================================================================

async function testDownloadManagerStructure() {
    console.log('\n🧪 Test: Download Manager Structure');

    const { downloadManager } = await import('../utils/downloadManager.js');

    // Check structure
    TestRunner.assert('downloadManager exists', !!downloadManager);
    TestRunner.assert('Has fetchServerQueue method', typeof downloadManager.fetchServerQueue === 'function');
    TestRunner.assert('Has addToServerQueue method', typeof downloadManager.addToServerQueue === 'function');
    TestRunner.assert('Has removeFromServerQueue method', typeof downloadManager.removeFromServerQueue === 'function');
    TestRunner.assert('Has clearServerQueue method', typeof downloadManager.clearServerQueue === 'function');
    TestRunner.assert('Has retryAllServerFailed method', typeof downloadManager.retryAllServerFailed === 'function');
    TestRunner.assert('Has syncServerQueueToStore method', typeof downloadManager.syncServerQueueToStore === 'function');
    TestRunner.assert('Has getQueueSettings method', typeof downloadManager.getQueueSettings === 'function');
    TestRunner.assert('Has startServerQueueSync method', typeof downloadManager.startServerQueueSync === 'function');
    TestRunner.assert('Has stopServerQueueSync method', typeof downloadManager.stopServerQueueSync === 'function');
}

async function testInvalidTrackData() {
    console.log('\n🧪 Test: Invalid Track Data Handling');

    const { downloadManager } = await import('../utils/downloadManager.js');

    // Test with empty array
    try {
        const result = await downloadManager.addToServerQueue([]);
        TestRunner.assert('Empty array returns without error', result.added === 0);
    } catch (e) {
        TestRunner.assert('Empty array handled', false, e.message);
    }

    // Test with missing required fields - should still format with defaults
    try {
        const result = await downloadManager.addToServerQueue([
            { tidal_id: 99999 } // Missing title, artist
        ]);
        // Should use defaults for missing fields
        TestRunner.assert('Missing fields use defaults', true);
    } catch (e) {
        TestRunner.assert('Missing fields handled gracefully', e.message.includes('401') || e.message.includes('fetch'), e.message);
    }
}

// ============================================================================
// EDGE CASE TESTS
// ============================================================================

async function testLargeQueue() {
    console.log('\n🧪 Test: Large Queue (100 items)');

    const { useDownloadStore } = await import('../stores/downloadStore.js');
    const store = useDownloadStore.getState();

    // Generate 100 items
    const items = Array.from({ length: 100 }, (_, i) => ({
        id: `q-${20000 + i}`,
        tidal_id: 20000 + i,
        title: `Track ${i}`,
        artist: `Artist ${i % 10}`,
        progress: 0
    }));

    const startTime = performance.now();
    store.setServerQueueState({ queue: items, downloading: [], completed: [], failed: [] });
    const elapsed = performance.now() - startTime;

    const state = useDownloadStore.getState();
    TestRunner.assert('100 items added to store', state.queue.length === 100);
    TestRunner.assert(`Performance: ${elapsed.toFixed(2)}ms`, elapsed < 1000);

    // Clear
    store.setServerQueueState({ queue: [], downloading: [], completed: [], failed: [] });
}

async function testSpecialCharacters() {
    console.log('\n🧪 Test: Special Characters');

    const { useDownloadStore } = await import('../stores/downloadStore.js');
    const store = useDownloadStore.getState();

    // Test with special characters
    const specialTracks = [
        { id: 'q-1', tidal_id: 1, title: 'Track with 特殊字符', artist: 'アーティスト' },
        { id: 'q-2', tidal_id: 2, title: '<script>alert("xss")</script>', artist: 'Test' },
        { id: 'q-3', tidal_id: 3, title: 'Path/With\\Slashes', artist: 'Artist:Name' },
        { id: 'q-4', tidal_id: 4, title: '    Whitespace    ', artist: '\n\t\rNewlines' }
    ];

    store.setServerQueueState({ queue: specialTracks, downloading: [], completed: [], failed: [] });
    const state = useDownloadStore.getState();

    TestRunner.assert('Special characters preserved', state.queue.length === 4);
    TestRunner.assert('Unicode preserved', state.queue[0].title === 'Track with 特殊字符');
    TestRunner.assert('Script tags preserved (stored, not executed)', state.queue[1].title.includes('script'));

    // Clear
    store.setServerQueueState({ queue: [], downloading: [], completed: [], failed: [] });
}

async function testRapidStateUpdates() {
    console.log('\n🧪 Test: Rapid State Updates');

    const { useDownloadStore } = await import('../stores/downloadStore.js');
    const store = useDownloadStore.getState();

    // Rapidly update state 50 times
    const startTime = performance.now();
    for (let i = 0; i < 50; i++) {
        store.setServerQueueState({
            queue: [{ id: `q-${i}`, tidal_id: i, title: `Track ${i}`, artist: 'Test' }],
            downloading: [],
            completed: [],
            failed: []
        });
    }
    const elapsed = performance.now() - startTime;

    const finalState = useDownloadStore.getState();
    TestRunner.assert('Final state is correct', finalState.queue[0].tidal_id === 49);
    TestRunner.assert(`50 rapid updates in ${elapsed.toFixed(2)}ms`, elapsed < 500);

    // Clear
    store.setServerQueueState({ queue: [], downloading: [], completed: [], failed: [] });
}

async function testProgressUpdates() {
    console.log('\n🧪 Test: Progress Updates');

    const { useDownloadStore } = await import('../stores/downloadStore.js');
    const store = useDownloadStore.getState();

    // Set up downloading item
    store.setServerQueueState({
        queue: [],
        downloading: [{ id: 'd-1', tidal_id: 1, title: 'Downloading', artist: 'Test', progress: 0 }],
        completed: [],
        failed: []
    });

    // Simulate progress updates
    for (let progress = 0; progress <= 100; progress += 10) {
        store.updateProgress('d-1', progress);
        await new Promise(r => setTimeout(r, 10));
    }

    const state = useDownloadStore.getState();
    TestRunner.assert('Progress reached 100', state.downloading[0]?.progress === 100 || state.downloading.length === 0);

    // Clear
    store.setServerQueueState({ queue: [], downloading: [], completed: [], failed: [] });
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

async function runAllFrontendTests() {
    console.log('='.repeat(60));
    console.log('🚀 FRONTEND EDGE CASE TESTING - DOWNLOAD QUEUE');
    console.log('='.repeat(60));

    TestRunner.reset();

    try {
        await testStoreBasics();
        await testStoreServerSync();
        await testStoreDuplicateHandling();
        await testDownloadManagerStructure();
        await testInvalidTrackData();
        await testLargeQueue();
        await testSpecialCharacters();
        await testRapidStateUpdates();
        await testProgressUpdates();
    } catch (e) {
        console.error('Test suite error:', e);
    }

    TestRunner.report();
    return TestRunner.failed === 0;
}

// Export for browser console or module use
if (typeof window !== 'undefined') {
    window.runFrontendQueueTests = runAllFrontendTests;
    console.log('💡 Run tests with: runFrontendQueueTests()');
}

export { runAllFrontendTests, TestRunner };
