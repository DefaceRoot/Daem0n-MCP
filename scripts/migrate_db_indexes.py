import sqlite3
import sys
import os
from pathlib import Path

def migrate_database(db_path):
    """
    Migrates the SQLite database to include new indexes for performance.
    """
    if not os.path.exists(db_path):
        print(f"Error: Database not found at {db_path}")
        return False

    print(f"Migrating database at: {db_path}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Define indexes to add
        indexes = [
            ("ix_external_dependencies_package_name", "external_dependencies", "package_name"),
            ("ix_tasks_status", "tasks", "status"),
            ("ix_tasks_priority", "tasks", "priority")
        ]

        changes_made = False
        for index_name, table, column in indexes:
            try:
                # Check if table exists first to avoid errors on empty/corrupt DBs
                cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
                if not cursor.fetchone():
                    print(f"  Skipping index {index_name}: Table '{table}' does not exist.")
                    continue

                print(f"  Creating index {index_name} on {table}({column})...", end=" ")
                cursor.execute(f"CREATE INDEX IF NOT EXISTS {index_name} ON {table} ({column})")
                print("Done.")
                changes_made = True
            except sqlite3.Error as e:
                print(f"Failed: {e}")

        if changes_made:
            conn.commit()
            print("Migration completed successfully.")
        else:
            print("No valid tables found to migrate.")
            
        conn.close()
        return True

    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return False

def find_databases(start_dir):
    """Recursively find .devilmcp/storage/devilmcp.db files."""
    db_files = []
    start_path = Path(start_dir)
    
    # Look in current dir
    default_loc = start_path / ".devilmcp" / "storage" / "devilmcp.db"
    if default_loc.exists():
        db_files.append(str(default_loc))

    # If we want to be more aggressive scanning:
    # for path in start_path.rglob("devilmcp.db"):
    #     db_files.append(str(path))
    
    return db_files

if __name__ == "__main__":
    # Check for provided path
    target_path = "."
    if len(sys.argv) > 1:
        target_path = sys.argv[1]
    
    # Handle direct file path
    if os.path.isfile(target_path):
        print(f"Targeting specific database file: {target_path}")
        migrate_database(target_path)
        sys.exit(0)

    # Handle directory search
    print(f"Searching for DevilMCP databases in: {os.path.abspath(target_path)}")
    dbs = find_databases(target_path)
    
    # Fallback: Recursive search if default location fails
    if not dbs:
        print("Standard location not found. Searching recursively (this may take a moment)...")
        for root, dirs, files in os.walk(target_path):
            if "devilmcp.db" in files:
                dbs.append(os.path.join(root, "devilmcp.db"))
                
    if not dbs:
        print("No 'devilmcp.db' files found.")
        print("Ensure you are pointing to the project root where DevilMCP has been used, or directly to the .db file.")
    else:
        print(f"Found {len(dbs)} database(s).")
        for db in dbs:
            migrate_database(db)
