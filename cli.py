import argparse
import asyncio
import sys
import json
import os
from typing import List, Dict, Any
from pathlib import Path

# Import internal modules
from database import DatabaseManager
from decision_tracker import DecisionTracker
from task_manager import TaskManager
from change_analyzer import ChangeAnalyzer
from cascade_detector import CascadeDetector
from context_manager import ContextManager

# Setup simple logging to stderr so stdout stays clean for JSON output
import logging
logging.basicConfig(level=logging.ERROR, format='%(message)s')

def get_storage_path():
    """Mimic server.py storage logic"""
    if os.getenv('STORAGE_PATH'):
        return os.getenv('STORAGE_PATH')
    return str(Path(os.getcwd()) / ".devilmcp" / "storage")

async def run_cli():
    parser = argparse.ArgumentParser(description="DevilMCP CLI Interface")
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")

    # --- Decision Tools ---
    decision_parser = subparsers.add_parser("log-decision", help="Log a new decision")
    decision_parser.add_argument("decision", help="The decision being made")
    decision_parser.add_argument("--rationale", required=True, help="Why this decision was made")
    decision_parser.add_argument("--context", default="{}", help="JSON string of context")
    decision_parser.add_argument("--tags", help="Comma-separated tags")

    # --- Task Tools ---
    task_parser = subparsers.add_parser("create-task", help="Create a new task")
    task_parser.add_argument("title", help="Task title")
    task_parser.add_argument("--desc", help="Task description")
    task_parser.add_argument("--priority", default="medium", choices=["low", "medium", "high"])
    task_parser.add_argument("--tags", help="Comma-separated tags")

    list_tasks_parser = subparsers.add_parser("list-tasks", help="List tasks")
    list_tasks_parser.add_argument("--status", default="todo", help="Filter by status")

    # --- Change Tools ---
    impact_parser = subparsers.add_parser("analyze-impact", help="Analyze change impact")
    impact_parser.add_argument("file", help="File path to analyze")
    impact_parser.add_argument("desc", help="Description of change")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    # Initialize Core
    storage_path = get_storage_path()
    db_manager = DatabaseManager(storage_path)
    await db_manager.init_db()

    try:
        # Execute Command
        if args.command == "log-decision":
            tracker = DecisionTracker(db_manager)
            tags_list = args.tags.split(",") if args.tags else []
            context_dict = json.loads(args.context)
            result = await tracker.log_decision(
                decision=args.decision,
                rationale=args.rationale,
                context=context_dict,
                tags=tags_list
            )
            print(json.dumps(result, indent=2, default=str))

        elif args.command == "create-task":
            tm = TaskManager(db_manager)
            tags_list = args.tags.split(",") if args.tags else []
            result = await tm.create_task(
                title=args.title,
                description=args.desc,
                priority=args.priority,
                tags=tags_list
            )
            print(json.dumps(result, indent=2, default=str))

        elif args.command == "list-tasks":
            tm = TaskManager(db_manager)
            results = await tm.list_tasks(status=args.status)
            print(json.dumps(results, indent=2, default=str))

        elif args.command == "analyze-impact":
            # This requires more setup (ContextManager + CascadeDetector)
            cd = CascadeDetector(db_manager)
            ca = ChangeAnalyzer(db_manager, cd)
            # We might need to init dependency graph if not persisted, 
            # but ChangeAnalyzer usually handles what it can.
            # For a true CLI, we might want to run analyze_project_structure first implicitly?
            # For now, just call the tool.
            result = await ca.analyze_change_impact(
                file_path=args.file,
                change_description=args.desc
            )
            print(json.dumps(result, indent=2, default=str))

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        await db_manager.close()

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(run_cli())
