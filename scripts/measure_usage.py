"""Repository CLI compatibility entry; canonical implementation ships with web-stand-in."""
import importlib.util
from pathlib import Path

_target = Path(__file__).resolve().parents[1] / "web-stand-in" / "scripts" / "measure_usage.py"
_spec = importlib.util.spec_from_file_location("web_stand_in_usage", _target)
_impl = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_impl)
FIELDS = _impl.FIELDS
snapshot = _impl.snapshot
difference = _impl.difference
main = _impl.main

if __name__ == "__main__":
    main()
