"""Deployment previews must preserve active configuration and quote literal paths."""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import unittest
import uuid

REPO = Path(__file__).resolve().parents[1]
ROOT = REPO / ".test-output/setup" / uuid.uuid4().hex
spec = importlib.util.spec_from_file_location("handoff_setup", REPO / "project-handoff/scripts/setup.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class SetupTests(unittest.TestCase):
    def setUp(self):
        self.root = ROOT / self._testMethodName
        self.root.mkdir(parents=True)

    def rendered(self):
        return m.render_hooks(sys.executable, REPO / "project-handoff", self.root / "state")

    def test_merge_preserves_other_hooks_and_is_idempotent(self):
        original = {"description": "keep this", "hooks": {"Stop": [
            {"hooks": [{"type": "command", "command": "existing-command"}]}]}}
        merged = m.merge_hooks(original, self.rendered())
        self.assertEqual(merged["description"], original["description"])
        self.assertEqual(merged["hooks"]["Stop"][0], original["hooks"]["Stop"][0])
        self.assertEqual(len(original["hooks"]["Stop"]), 1)
        self.assertEqual(m.merge_hooks(merged, self.rendered()), merged)

    def test_existing_counter_does_not_get_silently_duplicated(self):
        original = {"hooks": {"PostCompact": [{"hooks": [
            {"type": "command", "command": "python old/compaction_reminder.py"}]}]}}
        with self.assertRaises(ValueError):
            m.merge_hooks(original, self.rendered())

    def test_prepare_never_creates_live_state_or_configuration(self):
        live = self.root / "user-config"
        state = self.root / "live-state"
        result = m.prepare(self.root / "preview", REPO / "project-handoff", state, live, 4)
        self.assertFalse(result["applied"])
        self.assertFalse(live.exists())
        self.assertFalse(state.exists())
        plan = json.loads(Path(result["plan"]).read_text(encoding="utf-8"))
        self.assertFalse(plan["original_exists"])
        self.assertEqual(plan["proposed_sha256"], m.digest(Path(result["candidate"]).read_bytes()))
        with self.assertRaises(ValueError):
            m.prepare(self.root / "preview", REPO / "project-handoff", state, live, 4)

    def test_existing_config_backup_preserves_exact_bytes(self):
        live = self.root / "user-config"
        live.mkdir()
        original = b'\xef\xbb\xbf{\r\n"hooks": {}, "description":"preserve"\r\n}\r\n'
        (live / "hooks.json").write_bytes(original)
        m.prepare(self.root / "preview", REPO / "project-handoff", self.root / "state", live, 3)
        self.assertEqual((live / "hooks.json").read_bytes(), original)
        self.assertEqual((self.root / "preview/hooks.original.json").read_bytes(), original)

    def test_project_target_leaves_user_configuration_untouched(self):
        live = self.root / "user-config"
        live.mkdir()
        original = b'{"description":"user config","hooks":{}}'
        (live / "hooks.json").write_bytes(original)
        target = self.root / "project/.codex/hooks.json"
        result = m.prepare(self.root / "preview", REPO / "project-handoff",
                           self.root / "state", live, 3, target)
        self.assertEqual(result["target"], str(target))
        self.assertFalse(target.parent.exists())
        self.assertEqual((live / "hooks.json").read_bytes(), original)

    def test_rejects_unsafe_or_invalid_plan_inputs(self):
        for interval in (0, 101, True):
            with self.assertRaises(ValueError):
                m.render_hooks(sys.executable, REPO / "project-handoff", self.root, interval)
        for invalid in ([], {"hooks": []}, {"hooks": {"Stop": [None]}}):
            with self.assertRaises(ValueError):
                m.merge_hooks(invalid, self.rendered())

    def test_rendered_windows_command_uses_paths_literally(self):
        pwsh = shutil.which("pwsh")
        if os.name != "nt" or not pwsh:
            self.skipTest("Windows PowerShell 7 execution only")
        skill = self.root / "skill ' $literal (中文)"
        (skill / "scripts").mkdir(parents=True)
        shutil.copyfile(REPO / "project-handoff/scripts/compaction_reminder.py", skill / "scripts/compaction_reminder.py")
        state = self.root / "state ' $literal"
        config = m.render_hooks(sys.executable, skill, state)
        command = config["hooks"]["PostCompact"][0]["hooks"][0]["commandWindows"]
        result = subprocess.run([pwsh, "-NoProfile", "-Command", command],
            input=json.dumps(dict(session_id="synthetic", turn_id="t1", hook_event_name="PostCompact", trigger="auto")),
            text=True, encoding="utf-8", capture_output=True, timeout=15)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "")
        files = list(state.glob("*.json"))
        self.assertEqual(len(files), 1)
        self.assertEqual(json.loads(files[0].read_text(encoding="utf-8"))["auto_count"], 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
