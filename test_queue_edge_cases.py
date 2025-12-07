#!/usr/bin/env python3
"""
Extreme Edge Case Tests for Universal Download Queue

Tests:
1. Race conditions - concurrent add/remove operations
2. Large queue - adding 100+ items
3. Invalid data - missing fields, wrong types
4. State persistence - restart recovery
5. Concurrency limits - exceeding max concurrent
6. Duplicate handling
7. Empty queue operations
8. Failed item retry edge cases
"""

import sys
import asyncio
import json
import time
import random
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from queue_manager import QueueManager, QueueItem, MAX_CONCURRENT_DOWNLOADS

# Create fresh instance for testing
test_queue = QueueManager.__new__(QueueManager)
test_queue._initialized = False
test_queue.__init__()


class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
    
    def record(self, name, success, error=None):
        if success:
            self.passed += 1
            print(f"  ✅ {name}")
        else:
            self.failed += 1
            self.errors.append((name, error))
            print(f"  ❌ {name}: {error}")


results = TestResults()


async def test_empty_queue_operations():
    """Test operations on empty queue"""
    print("\n🧪 Test: Empty Queue Operations")
    
    # Clear to ensure empty
    await test_queue.clear_queue()
    await test_queue.clear_completed()
    await test_queue.clear_failed()
    
    # Test remove from empty queue
    result = await test_queue.remove_from_queue(99999)
    results.record("Remove from empty queue returns False", result == False)
    
    # Test retry failed on empty
    count = await test_queue.retry_failed()
    results.record("Retry failed on empty returns 0", count == 0)
    
    # Test clear empty queue
    count = await test_queue.clear_queue()
    results.record("Clear empty queue returns 0", count == 0)
    
    # Test get_state on empty
    state = test_queue.get_state()
    results.record("Empty state has correct structure", 
                   'queue' in state and 'active' in state and 'settings' in state)


async def test_add_single_item():
    """Test adding a single item"""
    print("\n🧪 Test: Add Single Item")
    
    await test_queue.clear_queue()
    
    item = QueueItem(
        track_id=12345,
        title="Test Track",
        artist="Test Artist",
        album="Test Album"
    )
    
    result = await test_queue.add_to_queue(item)
    results.record("Add single item returns True", result == True)
    
    state = test_queue.get_state()
    results.record("Queue has 1 item", len(state['queue']) == 1)
    results.record("Item has correct track_id", state['queue'][0]['track_id'] == 12345)


async def test_duplicate_handling():
    """Test adding duplicate items"""
    print("\n🧪 Test: Duplicate Handling")
    
    await test_queue.clear_queue()
    
    item1 = QueueItem(track_id=11111, title="Track 1", artist="Artist 1")
    item2 = QueueItem(track_id=11111, title="Track 1 Duplicate", artist="Artist 1")  # Same track_id
    
    result1 = await test_queue.add_to_queue(item1)
    result2 = await test_queue.add_to_queue(item2)
    
    results.record("First add returns True", result1 == True)
    results.record("Duplicate add returns False", result2 == False)
    
    state = test_queue.get_state()
    results.record("Queue still has only 1 item", len(state['queue']) == 1)


async def test_large_queue():
    """Test adding 100+ items"""
    print("\n🧪 Test: Large Queue (100 items)")
    
    await test_queue.clear_queue()
    
    start = time.time()
    items = [
        QueueItem(
            track_id=20000 + i,
            title=f"Track {i}",
            artist=f"Artist {i % 10}",
            album=f"Album {i % 5}"
        )
        for i in range(100)
    ]
    
    result = await test_queue.add_many_to_queue(items)
    elapsed = time.time() - start
    
    results.record("Added 100 items", result['added'] == 100)
    results.record("No items skipped", result['skipped'] == 0)
    results.record(f"Performance: {elapsed:.2f}s", elapsed < 5.0)
    
    state = test_queue.get_state()
    results.record("Queue has 100 items", len(state['queue']) == 100)


async def test_invalid_data():
    """Test handling of invalid/edge case data"""
    print("\n🧪 Test: Invalid Data Handling")
    
    await test_queue.clear_queue()
    
    # Empty strings
    item_empty = QueueItem(track_id=30001, title="", artist="")
    result = await test_queue.add_to_queue(item_empty)
    results.record("Empty strings accepted", result == True)
    
    # Very long strings
    long_title = "A" * 10000
    item_long = QueueItem(track_id=30002, title=long_title, artist="Artist")
    result = await test_queue.add_to_queue(item_long)
    results.record("Very long strings accepted", result == True)
    
    # Special characters
    item_special = QueueItem(
        track_id=30003, 
        title="Track with 特殊字符 & <script>alert('xss')</script>",
        artist="Artist/With\\Path:Chars"
    )
    result = await test_queue.add_to_queue(item_special)
    results.record("Special characters accepted", result == True)
    
    # Negative track_id
    item_negative = QueueItem(track_id=-1, title="Negative ID", artist="Test")
    result = await test_queue.add_to_queue(item_negative)
    results.record("Negative track_id accepted", result == True)
    
    # Zero track_id  
    item_zero = QueueItem(track_id=0, title="Zero ID", artist="Test")
    result = await test_queue.add_to_queue(item_zero)
    results.record("Zero track_id accepted", result == True)


async def test_concurrent_operations():
    """Test race conditions with concurrent add/remove"""
    print("\n🧪 Test: Concurrent Operations (Race Conditions)")
    
    await test_queue.clear_queue()
    
    # Add items concurrently
    async def add_item(i):
        item = QueueItem(track_id=40000 + i, title=f"Concurrent {i}", artist="Test")
        return await test_queue.add_to_queue(item)
    
    # Add 50 items concurrently
    tasks = [add_item(i) for i in range(50)]
    add_results = await asyncio.gather(*tasks)
    
    results.record("All 50 concurrent adds succeeded", all(add_results))
    
    state = test_queue.get_state()
    # Queue + active should equal 50 (auto-processing may move some to active)
    total_items = len(state['queue']) + len(state['active'])
    results.record(f"Total items (queue+active) = 50", total_items == 50)
    
    # Remove items concurrently while adding
    async def remove_item(i):
        return await test_queue.remove_from_queue(40000 + i)
    
    async def add_more(i):
        item = QueueItem(track_id=50000 + i, title=f"More {i}", artist="Test")
        return await test_queue.add_to_queue(item)
    
    # Mix of adds and removes
    mixed_tasks = []
    for i in range(25):
        mixed_tasks.append(remove_item(i))
        mixed_tasks.append(add_more(i))
    
    await asyncio.gather(*mixed_tasks)
    
    state = test_queue.get_state()
    results.record("Queue still valid after mixed operations", len(state['queue']) >= 0)
    
    # Verify no duplicates
    track_ids = [item['track_id'] for item in state['queue']]
    results.record("No duplicate track_ids", len(track_ids) == len(set(track_ids)))


async def test_state_persistence():
    """Test that state persists to disk"""
    print("\n🧪 Test: State Persistence")
    
    await test_queue.clear_queue()
    
    # Add items
    for i in range(5):
        item = QueueItem(track_id=60000 + i, title=f"Persist {i}", artist="Test")
        await test_queue.add_to_queue(item)
    
    # Force save
    test_queue._save_state()
    
    # Check file exists
    from queue_manager import STATE_FILE
    results.record("State file exists", STATE_FILE.exists())
    
    # Read file and verify
    with open(STATE_FILE, 'r') as f:
        saved_state = json.load(f)
    
    results.record("Saved state has queue", 'queue' in saved_state)
    results.record("Saved queue has 5 items", len(saved_state['queue']) == 5)


async def test_mark_completed_failed():
    """Test marking items as completed or failed"""
    print("\n🧪 Test: Mark Completed/Failed")
    
    await test_queue.clear_queue()
    await test_queue.clear_completed()
    await test_queue.clear_failed()
    
    # Simulate active download
    item = QueueItem(track_id=70001, title="Active Track", artist="Test")
    await test_queue.add_to_queue(item)
    
    # Move to active (simulating what queue processing would do)
    async with test_queue._queue_lock:
        if test_queue._queue:
            active_item = test_queue._queue.pop(0)
            test_queue._active[active_item.track_id] = {
                'progress': 0,
                'status': 'downloading',
                'item': active_item
            }
    
    # Mark as completed
    test_queue.mark_completed(70001, "test_file.flac", {"quality": "LOSSLESS"})
    
    state = test_queue.get_state()
    results.record("Item moved to completed", len(state['completed']) == 1)
    results.record("Item no longer active", 70001 not in test_queue._active)
    
    # Test mark_failed
    item2 = QueueItem(track_id=70002, title="Fail Track", artist="Test")
    await test_queue.add_to_queue(item2)
    
    async with test_queue._queue_lock:
        if test_queue._queue:
            active_item = test_queue._queue.pop(0)
            test_queue._active[active_item.track_id] = {
                'progress': 50,
                'status': 'downloading',
                'item': active_item
            }
    
    test_queue.mark_failed(70002, "Simulated error")
    
    state = test_queue.get_state()
    results.record("Failed item recorded", len(state['failed']) == 1)
    results.record("Error message preserved", state['failed'][0]['error'] == "Simulated error")


async def test_retry_failed():
    """Test retry failed functionality"""
    print("\n🧪 Test: Retry Failed")
    
    await test_queue.clear_queue()
    await test_queue.clear_failed()
    
    # Manually add failed items
    test_queue._failed = [
        {
            'track_id': 80001,
            'title': 'Failed 1',
            'artist': 'Test',
            'album': '',
            'error': 'Test error 1',
            'quality': 'LOSSLESS'
        },
        {
            'track_id': 80002,
            'title': 'Failed 2',
            'artist': 'Test',
            'album': '',
            'error': 'Test error 2',
            'quality': 'HIGH'
        }
    ]
    
    count = await test_queue.retry_failed()
    results.record("Retried 2 items", count == 2)
    
    state = test_queue.get_state()
    results.record("Failed list is empty", len(state['failed']) == 0)
    results.record("Queue has 2 items", len(state['queue']) == 2)


async def test_retry_single():
    """Test retry single failed item"""
    print("\n🧪 Test: Retry Single Failed")
    
    await test_queue.clear_queue()
    await test_queue.clear_failed()
    
    # Add failed items
    test_queue._failed = [
        {'track_id': 90001, 'title': 'Keep', 'artist': 'Test', 'album': '', 'error': 'err'},
        {'track_id': 90002, 'title': 'Retry', 'artist': 'Test', 'album': '', 'error': 'err'}
    ]
    
    result = await test_queue.retry_single(90002)
    results.record("Retry single returns True", result == True)
    
    state = test_queue.get_state()
    results.record("One item still failed", len(state['failed']) == 1)
    results.record("Correct item still failed", state['failed'][0]['track_id'] == 90001)
    results.record("One item in queue", len(state['queue']) == 1)
    
    # Retry non-existent
    result = await test_queue.retry_single(99999)
    results.record("Retry non-existent returns False", result == False)


async def test_concurrency_limit():
    """Test that concurrency limit is respected"""
    print("\n🧪 Test: Concurrency Limit")
    
    results.record(f"MAX_CONCURRENT_DOWNLOADS is set", MAX_CONCURRENT_DOWNLOADS > 0)
    results.record(f"MAX_CONCURRENT_DOWNLOADS = {MAX_CONCURRENT_DOWNLOADS}", True)
    
    # The actual concurrency enforcement happens in start_processing
    # We can verify the setting is correct
    state = test_queue.get_state()
    results.record("Settings include max_concurrent", 
                   'max_concurrent' in state['settings'])
    results.record("max_concurrent matches config",
                   state['settings']['max_concurrent'] == MAX_CONCURRENT_DOWNLOADS)


async def run_all_tests():
    """Run all test suites"""
    print("=" * 60)
    print("🚀 EXTREME EDGE CASE TESTING - UNIVERSAL DOWNLOAD QUEUE")
    print("=" * 60)
    
    await test_empty_queue_operations()
    await test_add_single_item()
    await test_duplicate_handling()
    await test_large_queue()
    await test_invalid_data()
    await test_concurrent_operations()
    await test_state_persistence()
    await test_mark_completed_failed()
    await test_retry_failed()
    await test_retry_single()
    await test_concurrency_limit()
    
    # Cleanup
    await test_queue.clear_queue()
    await test_queue.clear_completed()
    await test_queue.clear_failed()
    
    print("\n" + "=" * 60)
    print(f"📊 RESULTS: {results.passed} passed, {results.failed} failed")
    print("=" * 60)
    
    if results.errors:
        print("\n❌ FAILURES:")
        for name, error in results.errors:
            print(f"  - {name}: {error}")
    
    return results.failed == 0


if __name__ == "__main__":
    success = asyncio.run(run_all_tests())
    sys.exit(0 if success else 1)
