"""Read-only checks and reviewable Hook plans. Never enables or trusts hooks."""
import argparse
import ast
from copy import deepcopy
import hashlib
import json
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import sys
import tomllib

SKILL_DIR = Path(__file__).resolve().parents[1]
EVENTS = ("SessionStart", "UserPromptSubmit", "PostCompact", "Stop")
THREAD_TOOLS = ("list_projects", "create_thread", "wait_threads", "read_thread",
                "send_message_to_thread", "navigate_to_codex_page")


def absolute(value):
    path = Path(value).expanduser()
    if not path.is_absolute():
        raise ValueError("use an absolute path")
    return path.resolve()


def digest(data):
    return hashlib.sha256(data).hexdigest()


def version(command):
    try:
        result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8",
                                errors="replace", timeout=10)
        return result.stdout.strip()[:120] if result.returncode == 0 else None
    except (OSError, subprocess.TimeoutExpired):
        return None


def render_hooks(python, skill_dir, state_dir, interval=3):
    if type(interval) is not int or not 1 <= interval <= 100:
        raise ValueError("interval must be between 1 and 100")
    paths = [absolute(python), absolute(skill_dir), absolute(state_dir)]
    if any(any(c in str(p) for c in "\r\n\x00") for p in paths):
        raise ValueError("paths must be single-line values")
    args = [str(paths[0]), "-B", "-X", "utf8", str(paths[1] / "scripts/compaction_reminder.py"),
            "--state-dir", str(paths[2]), "--interval", str(interval)]
    # Shell-specific quoting: paths containing $, apostrophes or spaces stay literal.
    posix = shlex.join(args)
    windows = "& " + " ".join("'" + arg.replace("'", "''") + "'" for arg in args)
    template = json.loads((SKILL_DIR / "hooks/codex-hooks.example.json").read_text(encoding="utf-8"))
    for groups in template["hooks"].values():
        for group in groups:
            for hook in group["hooks"]:
                hook.update(command=posix, commandWindows=windows)
    return template


def merge_hooks(existing, additions):
    if not isinstance(existing, dict) or not isinstance(existing.get("hooks", {}), dict):
        raise ValueError("hooks.json must contain an object")
    result = deepcopy(existing)
    target = result.setdefault("hooks", {})
    for name, groups in target.items():
        if not isinstance(groups, list):
            raise ValueError("invalid hook groups")
        for group in groups:
            if not isinstance(group, dict) or not isinstance(group.get("hooks"), list):
                raise ValueError("invalid hook group")
            for handler in group["hooks"]:
                if not isinstance(handler, dict):
                    raise ValueError("invalid hook handler")
                commands = str(handler.get("command", "")) + str(handler.get("commandWindows", ""))
                if "compaction_reminder.py" in commands:
                    # Do not silently install a second counter or replace an older installation.
                    expected = additions["hooks"].get(name, [])
                    if group not in expected:
                        raise ValueError("existing project-handoff hook differs; review migration before merging")
    for name, groups in additions["hooks"].items():
        current = target.setdefault(name, [])
        for group in groups:
            if group not in current:
                current.append(deepcopy(group))
    return result


def inspect_environment(skill_dir, state_dir, codex_home, capabilities=None, hooks_file=None):
    required = ("SKILL.md", "agents/openai.yaml", "references/handoff.md",
                "references/compaction-reminder.md", "references/setup.md",
                "scripts/compaction_reminder.py", "hooks/codex-hooks.example.json")
    missing = [name for name in required if not (skill_dir / name).is_file()]
    syntax_ok = True
    if not missing:
        try:
            ast.parse((skill_dir / "scripts/compaction_reminder.py").read_text(encoding="utf-8"))
        except SyntaxError:
            syntax_ok = False
    codex = shutil.which("codex")
    pwsh = shutil.which("pwsh")
    hooks_path = hooks_file or codex_home / "hooks.json"
    config_path = codex_home / "config.toml"
    config = tomllib.loads(config_path.read_text(encoding="utf-8-sig")) if config_path.exists() else {}
    policy = dict(hooks_enabled=config.get("features", {}).get("hooks",
                  config.get("features", {}).get("codex_hooks", True)),
                  managed_only=config.get("allow_managed_hooks_only", False))
    nearest = state_dir
    while not nearest.exists() and nearest != nearest.parent:
        nearest = nearest.parent
    tools = None
    if capabilities is not None:
        data = json.loads(capabilities.read_text(encoding="utf-8"))
        if not isinstance(data, list) or not all(isinstance(name, str) for name in data):
            raise ValueError("capabilities must be a JSON array of tool names")
        tools = {name: any(item == name or item.endswith("__" + name) for item in data)
                 for name in THREAD_TOOLS}
    codex_version = version([codex, "--version"]) if codex else None
    pwsh_version = version([pwsh, "-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"] ) if pwsh else None
    runtime_ok = (sys.version_info >= (3, 11) and syntax_ok and not missing)
    return dict(skill_dir=str(skill_dir), python=sys.version.split()[0], python_exe=sys.executable,
                missing_files=missing, python_syntax_ok=syntax_ok, codex_version=codex_version,
                powershell_version=pwsh_version, state_dir=str(state_dir),
                state_parent_exists=nearest.is_dir(), state_parent_writable_hint=os.access(nearest, os.W_OK),
                target_hooks_file=str(hooks_path), target_hooks_exists=hooks_path.exists(),
                user_policy=policy, thread_tools=tools,
                manual_files_ready=runtime_ok,
                hook_prerequisites_ready=bool(runtime_ok and codex_version and
                    (os.name != "nt" or (pwsh_version and pwsh_version.startswith("7."))) and
                    policy["hooks_enabled"] and not policy["managed_only"]),
                native_trust="not_checked", real_host_events="not_tested",
                note="Read-only local checks; project/admin policy and runtime tools may differ. This does not enable hooks.")


def prepare(output, skill_dir, state_dir, codex_home, interval, hooks_file=None):
    target = hooks_file or codex_home / "hooks.json"
    if target.name != "hooks.json":
        raise ValueError("target must be named hooks.json beside an active Codex config layer")
    if output.exists():
        raise ValueError("output directory already exists; use a new plan directory")
    before = target.read_bytes() if target.exists() else None
    original = json.loads(before.decode("utf-8-sig")) if before is not None else {}
    rendered = render_hooks(sys.executable, skill_dir, state_dir, interval)
    proposed = merge_hooks(original, rendered)
    encoded = (json.dumps(proposed, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    plan = dict(target=str(target), original_exists=before is not None,
                original_sha256=digest(before) if before is not None else None,
                proposed_sha256=digest(encoded), skill_dir=str(skill_dir), state_dir=str(state_dir),
                interval_for_new_sessions=interval, actions=["review", "approve_config_change", "merge", "native_hook_trust", "host_acceptance"],
                applied=False)
    output.mkdir(parents=True)
    if before is not None:
        (output / "hooks.original.json").write_bytes(before)
    (output / "hooks.proposed.json").write_bytes(encoded)
    (output / "plan.json").write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return dict(plan=str(output / "plan.json"), candidate=str(output / "hooks.proposed.json"),
                target=str(target), applied=False, next_step="Review the candidate; obtain approval before changing configuration, then use native Hook trust.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("doctor", "prepare"))
    parser.add_argument("--skill-dir", type=absolute, default=SKILL_DIR)
    parser.add_argument("--state-dir", type=absolute, required=True)
    parser.add_argument("--codex-home", type=absolute,
                        default=Path(os.environ.get("CODEX_HOME", str(Path.home() / ".codex"))))
    parser.add_argument("--capabilities", type=absolute)
    parser.add_argument("--hooks-file", type=absolute,
                        help="target hooks.json, e.g. D:/project/.codex/hooks.json; default: CODEX_HOME/hooks.json")
    parser.add_argument("--output", type=absolute)
    parser.add_argument("--interval", type=int, default=3)
    args = parser.parse_args()
    try:
        if args.action == "doctor":
            result = inspect_environment(args.skill_dir, args.state_dir, args.codex_home, args.capabilities, args.hooks_file)
        else:
            if args.output is None:
                raise ValueError("prepare requires --output")
            result = prepare(args.output, args.skill_dir, args.state_dir, args.codex_home, args.interval, args.hooks_file)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except (OSError, ValueError, TypeError, KeyError) as error:
        print(json.dumps(dict(error=type(error).__name__, message=str(error), applied=False), ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
