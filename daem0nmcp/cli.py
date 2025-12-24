"""
Daem0nMCP CLI - Command-line interface for memory checks.

Used by pre-commit hooks and direct invocation.

Usage:
    python -m daem0nmcp.cli [--json] [--project-path PATH] <command>

    python -m daem0nmcp.cli check <filepath>
    python -m daem0nmcp.cli briefing
    python -m daem0nmcp.cli scan-todos [--auto-remember] [--path PATH]
    python -m daem0nmcp.cli migrate [--backfill-vectors]
    python -m daem0nmcp.cli pre-commit [--interactive] [--staged-files FILE ...]

Global Options:
    --json              Output as JSON for automation/scripting
    --project-path PATH Specify project root path (sets DAEM0NMCP_PROJECT_ROOT)
"""

import sys
import os
import asyncio
import argparse
import json
from pathlib import Path

from .config import settings
from .database import DatabaseManager
from .memory import MemoryManager
from .rules import RulesEngine


async def check_file(filepath: str, db: DatabaseManager, memory: MemoryManager, rules: RulesEngine) -> dict:
    """Check a file against memories and rules."""
    await db.init_db()

    results = {
        "file": filepath,
        "warnings": [],
        "blockers": [],
        "must_do": [],
        "must_not": []
    }

    # Get file-specific memories
    file_memories = await memory.recall_for_file(filepath, project_path=settings.project_root)

    # Check for warnings in file memories
    for cat in ['warnings', 'decisions', 'patterns', 'learnings']:
        for mem in file_memories.get(cat, []):
            if mem.get('worked') is False:
                results["warnings"].append({
                    "type": "FAILED_APPROACH",
                    "content": mem['content'],
                    "outcome": mem.get('outcome')
                })
            elif cat == 'warnings':
                results["warnings"].append({
                    "type": "WARNING",
                    "content": mem['content']
                })

    # Check rules based on filename
    filename = Path(filepath).name
    rule_check = await rules.check_rules(f"modifying {filename}")

    if rule_check.get('guidance'):
        guidance = rule_check['guidance']
        results["must_do"] = guidance.get('must_do', [])
        results["must_not"] = guidance.get('must_not', [])

        # Rule warnings become blockers if high priority
        for warning in guidance.get('warnings', []):
            results["warnings"].append({
                "type": "RULE_WARNING",
                "content": warning
            })

    return results


async def get_briefing(db: DatabaseManager, memory: MemoryManager) -> dict:
    """Get session briefing."""
    await db.init_db()
    return await memory.get_statistics()


async def run_precommit(checker, staged_files: list, project_path: str, interactive: bool, json_output: bool) -> int:
    """
    Run pre-commit checks and return exit code.

    Args:
        checker: PreCommitChecker instance
        staged_files: List of file paths being committed
        project_path: Project root path
        interactive: If True, prompt user for warnings
        json_output: If True, output JSON instead of human-readable text

    Returns:
        Exit code: 0 (success), 1 (blocked), 2 (user cancelled)
    """
    try:
        await checker.db.init_db()
        result = await checker.check(staged_files=staged_files, project_path=project_path)
    except Exception as e:
        if json_output:
            print(json.dumps({"error": str(e), "can_commit": False, "blocks": [], "warnings": []}))
        else:
            print(f"ERROR: Pre-commit check failed: {e}", file=sys.stderr)
        return 1

    if json_output:
        print(json.dumps(result, default=str))
        return 0 if result["can_commit"] else 1

    # Print blocks
    if result["blocks"]:
        print("BLOCKED: The following issues must be resolved:\n")
        for block in result["blocks"]:
            print(f"  [{block['type']}] {block['message']}")
        print()

    # Print warnings
    if result["warnings"]:
        print("WARNINGS:\n")
        for warn in result["warnings"]:
            print(f"  {warn['message']}")
        print()

    # Clean result
    if not result["blocks"] and not result["warnings"]:
        print("OK: No enforcement issues found.")
        return 0

    # Blocked - must resolve
    if result["blocks"]:
        print("\nCommit blocked. Resolve issues with:")
        print("  python -m daem0nmcp.cli status")
        print("  python -m daem0nmcp.cli record-outcome <id> \"<outcome>\" --worked|--failed")
        return 1

    # Warnings only - can proceed with confirmation
    if interactive:
        response = input("\nProceed with commit despite warnings? [y/N]: ").strip().lower()
        if response != "y":
            print("Commit cancelled by user.")
            return 2

    return 0


def format_check_result(result: dict) -> str:
    """Format check result for CLI output."""
    lines = []

    if result["warnings"]:
        for w in result["warnings"]:
            lines.append(f"WARNING [{w['type']}]: {w['content']}")
            if w.get('outcome'):
                lines.append(f"  Outcome: {w['outcome']}")

    if result["must_do"]:
        lines.append("MUST DO:")
        for item in result["must_do"]:
            lines.append(f"  - {item}")

    if result["must_not"]:
        lines.append("MUST NOT:")
        for item in result["must_not"]:
            lines.append(f"  - {item}")

    if not lines:
        lines.append("OK: No concerns found")

    return "\n".join(lines)


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(description="Daem0nMCP CLI")

    # Global options
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--project-path", help="Project root path")

    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # check command
    check_parser = subparsers.add_parser("check", help="Check a file against memory")
    check_parser.add_argument("filepath", help="File to check")

    # briefing command
    subparsers.add_parser("briefing", help="Get session briefing")

    # scan-todos command
    scan_parser = subparsers.add_parser("scan-todos", help="Scan for TODO/FIXME comments")
    scan_parser.add_argument("--auto-remember", action="store_true", help="Auto-create warnings")
    scan_parser.add_argument("--path", help="Path to scan", default=".")

    # migrate command
    migrate_parser = subparsers.add_parser("migrate", help="Run database migrations")
    migrate_parser.add_argument("--backfill-vectors", action="store_true",
                                help="Backfill vector embeddings for existing memories")

    # pre-commit command
    precommit_parser = subparsers.add_parser("pre-commit", help="Run pre-commit enforcement checks")
    precommit_parser.add_argument("--interactive", "-i", action="store_true",
                                  help="Prompt for resolution of warnings")
    precommit_parser.add_argument("--staged-files", nargs="*", default=None,
                                  help="Staged files (auto-detected from git if not provided)")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    # Set project path if provided
    if args.project_path:
        os.environ['DAEM0NMCP_PROJECT_ROOT'] = args.project_path

    # Initialize components
    storage_path = settings.get_storage_path()
    db = DatabaseManager(storage_path)
    memory = MemoryManager(db)
    rules = RulesEngine(db)

    if args.command == "check":
        result = asyncio.run(check_file(args.filepath, db, memory, rules))
        if args.json:
            print(json.dumps(result, default=str))
        else:
            print(format_check_result(result))

    elif args.command == "briefing":
        result = asyncio.run(get_briefing(db, memory))
        if args.json:
            print(json.dumps(result, default=str))
        else:
            print(f"Total memories: {result.get('total_memories', 0)}")
            print(f"By category: {result.get('by_category', {})}")
            if result.get('learning_insights', {}).get('suggestion'):
                print(f"Suggestion: {result['learning_insights']['suggestion']}")

    elif args.command == "scan-todos":
        # Import here to avoid circular imports
        from .server import _scan_for_todos

        todos = _scan_for_todos(args.path)
        if args.json:
            result = {
                "total": len(todos),
                "todos": todos
            }
            print(json.dumps(result, default=str))
        else:
            print(f"Found {len(todos)} TODO/FIXME items:")
            for todo in todos[:20]:  # Limit output
                print(f"  [{todo['type']}] {todo['file']}:{todo['line']} - {todo['content'][:60]}")
            if len(todos) > 20:
                print(f"  ... and {len(todos) - 20} more")

    elif args.command == "migrate":
        from .migrations import run_migrations, migrate_and_backfill_vectors

        db_path = str(Path(storage_path) / "daem0nmcp.db")

        if args.backfill_vectors:
            result = migrate_and_backfill_vectors(db_path)
            if args.json:
                result['database'] = db_path
                print(json.dumps(result, default=str))
            else:
                print(f"Database: {db_path}")
                print(f"\nMigration complete:")
                print(f"  Schema migrations: {result['schema_migrations']}")
                for m in result.get('applied', []):
                    print(f"    - {m}")
                print(f"  Vectors backfilled: {result['vectors_backfilled']}")
                print(f"  Vectors available: {result['vectors_available']}")
                print(f"\n{result['message']}")
        else:
            count, applied = run_migrations(db_path)
            if args.json:
                result = {
                    "database": db_path,
                    "schema_migrations": count,
                    "applied": applied,
                    "up_to_date": count == 0
                }
                print(json.dumps(result, default=str))
            else:
                print(f"Database: {db_path}")
                print(f"\nSchema migrations applied: {count}")
                for m in applied:
                    print(f"  - {m}")
                if count == 0:
                    print("Database is up to date.")
                print("\nTo also backfill vectors, run: python -m daem0nmcp.cli migrate --backfill-vectors")

    elif args.command == "pre-commit":
        import subprocess
        from .enforcement import PreCommitChecker

        # Get staged files from git if not provided
        staged_files = args.staged_files
        if staged_files is None:
            try:
                result = subprocess.run(
                    ["git", "diff", "--cached", "--name-only"],
                    capture_output=True, text=True, check=False,
                    cwd=args.project_path or "."
                )
                staged_files = [f.strip() for f in result.stdout.strip().split("\n") if f.strip()]
            except (subprocess.SubprocessError, FileNotFoundError, OSError):
                staged_files = []

        project_path = args.project_path or os.getcwd()
        checker = PreCommitChecker(db, memory)
        exit_code = asyncio.run(run_precommit(checker, staged_files, project_path, args.interactive, args.json))
        sys.exit(exit_code)


if __name__ == "__main__":
    main()
