"""Read-only usage snapshots of an explicitly identified Codex task. No history scan."""
import argparse
import json
from pathlib import Path

FIELDS = ("input_tokens", "cached_input_tokens", "output_tokens", "reasoning_output_tokens", "total_tokens")


def snapshot(transcript, session_id):
    latest = None
    with Path(transcript).open(encoding="utf-8-sig") as handle:
        first = json.loads(handle.readline())
        if first.get("type") != "session_meta" or first.get("payload", {}).get("id") != session_id:
            raise ValueError("Transcript identity mismatch")
        for line in handle:
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                # A running host may have written an incomplete final line.
                if not line.endswith("\n"):
                    break
                raise
            payload = record.get("payload", {})
            if record.get("type") == "event_msg" and payload.get("type") == "token_count":
                usage = (payload.get("info") or {}).get("total_token_usage")
                if usage is not None:
                    if any(type(usage.get(k)) is not int or usage[k] < 0 for k in FIELDS):
                        raise ValueError("Unsupported token usage schema")
                    latest = {"timestamp": record.get("timestamp"), "tokens": {k: usage[k] for k in FIELDS}}
    if latest is None:
        raise ValueError("No host token counts; usage is unknown, not zero")
    return {"schema": "codex-usage-snapshot-v1", "session_id": session_id,
            "source": str(Path(transcript).resolve()), **latest,
            "chatgpt_web_tokens": None, "billing_cost": None}


def difference(before, after):
    if (before.get("schema") != "codex-usage-snapshot-v1" or after.get("schema") != before["schema"] or
            before.get("session_id") != after.get("session_id") or before.get("source") != after.get("source")):
        raise ValueError("Usage snapshots must belong to the same transcript")
    delta = {}
    for k in FIELDS:
        a, b = before["tokens"].get(k), after["tokens"].get(k)
        if type(a) is not int or type(b) is not int or a < 0 or b < a:
            raise ValueError("Invalid/reset counters; cannot infer a delta")
        delta[k] = b - a
    return {"schema": "codex-usage-delta-v1", "session_id": after["session_id"],
            "from": before["timestamp"], "through": after["timestamp"], "tokens": delta,
            "chatgpt_web_tokens": None, "billing_cost": None, "savings_claim": None,
            "note": "Cached input is included in input; reasoning is included in output. Host-recorded Codex usage only."}


def main():
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command", required=True)
    snap = commands.add_parser("snapshot")
    snap.add_argument("--transcript", type=Path, required=True)
    snap.add_argument("--session-id", required=True)
    diff = commands.add_parser("diff")
    diff.add_argument("--before", type=Path, required=True)
    diff.add_argument("--after", type=Path, required=True)
    for command in (snap, diff):
        command.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = (snapshot(args.transcript, args.session_id) if args.command == "snapshot" else
              difference(json.loads(args.before.read_text(encoding="utf-8-sig")),
                         json.loads(args.after.read_text(encoding="utf-8-sig"))))
    # Never replace another run's evidence or source transcript.
    with args.output.open("x", encoding="utf-8") as handle:
        json.dump(result, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
