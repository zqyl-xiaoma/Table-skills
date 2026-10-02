import importlib.util
import json
from pathlib import Path
import unittest
import uuid

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('usage', ROOT / 'scripts/measure_usage.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class UsageTests(unittest.TestCase):
    def fixture(self, records):
        directory = ROOT / '.test-output/usage-tests' / uuid.uuid4().hex
        directory.mkdir(parents=True)
        transcript = directory / 'task.jsonl'
        transcript.write_text('\n'.join(json.dumps(r) for r in records) + '\n', encoding='utf-8')
        return transcript

    def test_snapshot_identity_and_latest_cumulative_not_sum(self):
        records = [{'type': 'session_meta', 'payload': {'id': 'task'}}]
        for n in (10, 20):
            records.append({'type': 'event_msg', 'timestamp': str(n), 'payload': {
                'type': 'token_count', 'info': {'total_token_usage': {
                    'input_tokens': n, 'cached_input_tokens': 5, 'output_tokens': 4,
                    'reasoning_output_tokens': 2, 'total_tokens': n + 4}}}})
        p = self.fixture(records)
        result = m.snapshot(p, 'task')
        self.assertEqual(result['tokens']['total_tokens'], 24)
        self.assertIsNone(result['chatgpt_web_tokens'])
        with self.assertRaises(ValueError): m.snapshot(p, 'other-task')
        before = {**result, 'tokens': {k: 0 for k in m.FIELDS}}
        self.assertEqual(m.difference(before, result)['tokens']['total_tokens'], 24)
        with self.assertRaises(ValueError): m.difference(result, before)
        with self.assertRaises(ValueError): m.difference(before, {**result, 'session_id': 'other'})

    def test_missing_usage_is_not_zero_and_partial_final_line_is_ignored(self):
        p = self.fixture([{'type': 'session_meta', 'payload': {'id': 'task'}}])
        with p.open('a', encoding='utf-8') as f: f.write('{"partial":')
        with self.assertRaisesRegex(ValueError, 'unknown'): m.snapshot(p, 'task')


if __name__ == '__main__': unittest.main()
