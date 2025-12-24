# Enhanced Bootstrap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand first-run bootstrap from 2 memories to 5-8 categorized memories for comprehensive project awareness.

**Architecture:** Add 5 new extractor functions that parse project files (manifests, docs, structure) and return formatted content. Update `_bootstrap_project_context()` to call all extractors and create memories. Each extractor is isolated—failure in one doesn't affect others.

**Tech Stack:** Python 3.10+, pathlib, json, tomllib (Python 3.11+) or tomli fallback, async SQLAlchemy

---

## Task 1: Add Excluded Directories Constant

**Files:**
- Modify: `daem0nmcp/server.py:730` (before `_get_git_history_summary`)

**Step 1: Add the constant**

Add this constant near line 730, before the `_get_git_history_summary` function:

```python
# Directories to exclude when scanning project structure
BOOTSTRAP_EXCLUDED_DIRS = {
    'node_modules', '.git', '__pycache__', '.venv', 'venv',
    'dist', 'build', '.next', 'target', '.idea', '.vscode',
    '.eggs', 'eggs', '.tox', '.nox', '.mypy_cache', '.pytest_cache',
    '.ruff_cache', 'htmlcov', '.coverage', 'site-packages'
}
```

**Step 2: Verify no syntax errors**

Run: `python -c "from daem0nmcp import server; print('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add daem0nmcp/server.py
git commit -m "feat(bootstrap): add BOOTSTRAP_EXCLUDED_DIRS constant"
```

---

## Task 2: Add Project Identity Extractor

**Files:**
- Modify: `daem0nmcp/server.py` (after the constant, ~line 740)
- Test: `tests/test_bootstrap.py` (new file)

**Step 1: Write the failing test**

Create `tests/test_bootstrap.py`:

```python
"""Tests for enhanced bootstrap functionality."""
import json
import tempfile
from pathlib import Path

import pytest

from daem0nmcp.server import _extract_project_identity


class TestExtractProjectIdentity:
    """Tests for _extract_project_identity extractor."""

    def test_extracts_package_json(self, tmp_path):
        """Should extract name, description, and dependencies from package.json."""
        package = {
            "name": "my-app",
            "version": "1.0.0",
            "description": "A test application",
            "scripts": {"test": "jest", "build": "webpack"},
            "dependencies": {"react": "^18.0.0", "lodash": "^4.17.0"}
        }
        (tmp_path / "package.json").write_text(json.dumps(package))

        result = _extract_project_identity(str(tmp_path))

        assert result is not None
        assert "my-app" in result
        assert "A test application" in result
        assert "react" in result

    def test_extracts_pyproject_toml(self, tmp_path):
        """Should extract project info from pyproject.toml."""
        pyproject = '''
[project]
name = "my-python-app"
version = "2.0.0"
description = "A Python application"
dependencies = ["fastapi", "sqlalchemy"]
'''
        (tmp_path / "pyproject.toml").write_text(pyproject)

        result = _extract_project_identity(str(tmp_path))

        assert result is not None
        assert "my-python-app" in result
        assert "A Python application" in result

    def test_returns_none_when_no_manifest(self, tmp_path):
        """Should return None when no manifest file exists."""
        result = _extract_project_identity(str(tmp_path))
        assert result is None

    def test_package_json_takes_priority(self, tmp_path):
        """When multiple manifests exist, package.json wins."""
        (tmp_path / "package.json").write_text('{"name": "node-app"}')
        (tmp_path / "pyproject.toml").write_text('[project]\nname = "python-app"')

        result = _extract_project_identity(str(tmp_path))

        assert "node-app" in result
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_bootstrap.py::TestExtractProjectIdentity -v`
Expected: FAIL with `cannot import name '_extract_project_identity'`

**Step 3: Write the implementation**

Add to `daem0nmcp/server.py` after the constant (~line 740):

```python
def _extract_project_identity(project_path: str) -> Optional[str]:
    """
    Extract project identity from manifest files.

    Tries manifests in priority order:
    1. package.json (Node.js)
    2. pyproject.toml (Python)
    3. Cargo.toml (Rust)
    4. go.mod (Go)

    Returns:
        Formatted string with project name, description, and key dependencies,
        or None if no manifest found.
    """
    root = Path(project_path)

    # Try package.json first
    package_json = root / "package.json"
    if package_json.exists():
        try:
            data = json.loads(package_json.read_text(encoding='utf-8', errors='ignore'))
            parts = []
            if data.get('name'):
                parts.append(f"Project: {data['name']}")
            if data.get('description'):
                parts.append(f"Description: {data['description']}")
            if data.get('scripts'):
                scripts = ', '.join(list(data['scripts'].keys())[:5])
                parts.append(f"Scripts: {scripts}")
            deps = list(data.get('dependencies', {}).keys())[:10]
            dev_deps = list(data.get('devDependencies', {}).keys())[:5]
            if deps:
                parts.append(f"Dependencies: {', '.join(deps)}")
            if dev_deps:
                parts.append(f"Dev dependencies: {', '.join(dev_deps)}")
            if parts:
                return "Tech stack (from package.json):\n" + "\n".join(parts)
        except Exception as e:
            logger.debug(f"Failed to parse package.json: {e}")

    # Try pyproject.toml
    pyproject = root / "pyproject.toml"
    if pyproject.exists():
        try:
            content = pyproject.read_text(encoding='utf-8', errors='ignore')
            # Simple parsing without external deps
            parts = []
            for line in content.split('\n'):
                line = line.strip()
                if line.startswith('name = '):
                    parts.append(f"Project: {line.split('=', 1)[1].strip().strip('\"')}")
                elif line.startswith('description = '):
                    parts.append(f"Description: {line.split('=', 1)[1].strip().strip('\"')}")
            # Extract dependencies list
            if 'dependencies = [' in content:
                start = content.find('dependencies = [')
                end = content.find(']', start)
                if end > start:
                    deps_str = content[start:end+1]
                    deps = [d.strip().strip('"').strip("'").split('[')[0].split('>')[0].split('<')[0].split('=')[0]
                            for d in deps_str.split('[')[1].split(']')[0].split(',')
                            if d.strip()]
                    if deps:
                        parts.append(f"Dependencies: {', '.join(deps[:10])}")
            if parts:
                return "Tech stack (from pyproject.toml):\n" + "\n".join(parts)
        except Exception as e:
            logger.debug(f"Failed to parse pyproject.toml: {e}")

    # Try Cargo.toml
    cargo = root / "Cargo.toml"
    if cargo.exists():
        try:
            content = cargo.read_text(encoding='utf-8', errors='ignore')
            parts = []
            for line in content.split('\n'):
                line = line.strip()
                if line.startswith('name = '):
                    parts.append(f"Project: {line.split('=', 1)[1].strip().strip('\"')}")
                elif line.startswith('description = '):
                    parts.append(f"Description: {line.split('=', 1)[1].strip().strip('\"')}")
            if parts:
                return "Tech stack (from Cargo.toml):\n" + "\n".join(parts)
        except Exception as e:
            logger.debug(f"Failed to parse Cargo.toml: {e}")

    # Try go.mod
    gomod = root / "go.mod"
    if gomod.exists():
        try:
            content = gomod.read_text(encoding='utf-8', errors='ignore')
            parts = []
            for line in content.split('\n'):
                line = line.strip()
                if line.startswith('module '):
                    parts.append(f"Module: {line.split(' ', 1)[1]}")
                elif line.startswith('go '):
                    parts.append(f"Go version: {line.split(' ', 1)[1]}")
            if parts:
                return "Tech stack (from go.mod):\n" + "\n".join(parts)
        except Exception as e:
            logger.debug(f"Failed to parse go.mod: {e}")

    return None
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_bootstrap.py::TestExtractProjectIdentity -v`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add daem0nmcp/server.py tests/test_bootstrap.py
git commit -m "feat(bootstrap): add _extract_project_identity extractor"
```

---

## Task 3: Add Architecture Extractor

**Files:**
- Modify: `daem0nmcp/server.py` (after `_extract_project_identity`)
- Modify: `tests/test_bootstrap.py`

**Step 1: Write the failing test**

Add to `tests/test_bootstrap.py`:

```python
from daem0nmcp.server import _extract_architecture


class TestExtractArchitecture:
    """Tests for _extract_architecture extractor."""

    def test_extracts_readme_content(self, tmp_path):
        """Should extract first 2000 chars from README.md."""
        readme = "# My Project\n\nThis is a test project.\n\n## Features\n- Feature 1\n- Feature 2"
        (tmp_path / "README.md").write_text(readme)

        result = _extract_architecture(str(tmp_path))

        assert result is not None
        assert "My Project" in result
        assert "Feature 1" in result

    def test_includes_directory_structure(self, tmp_path):
        """Should include top-level directory structure."""
        (tmp_path / "src").mkdir()
        (tmp_path / "tests").mkdir()
        (tmp_path / "docs").mkdir()
        (tmp_path / "README.md").write_text("# Test")

        result = _extract_architecture(str(tmp_path))

        assert "src" in result
        assert "tests" in result

    def test_excludes_noise_directories(self, tmp_path):
        """Should exclude node_modules, .git, etc."""
        (tmp_path / "src").mkdir()
        (tmp_path / "node_modules").mkdir()
        (tmp_path / ".git").mkdir()

        result = _extract_architecture(str(tmp_path))

        assert result is not None
        assert "node_modules" not in result
        assert ".git" not in result

    def test_returns_structure_only_without_readme(self, tmp_path):
        """Should return directory structure even without README."""
        (tmp_path / "src").mkdir()
        (tmp_path / "lib").mkdir()

        result = _extract_architecture(str(tmp_path))

        assert result is not None
        assert "src" in result
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_bootstrap.py::TestExtractArchitecture -v`
Expected: FAIL with `cannot import name '_extract_architecture'`

**Step 3: Write the implementation**

Add to `daem0nmcp/server.py`:

```python
def _extract_architecture(project_path: str) -> Optional[str]:
    """
    Extract architecture overview from README and directory structure.

    Combines:
    1. README.md content (first 2000 chars)
    2. Top-level directory structure (excluding noise)

    Returns:
        Formatted string with architecture overview, or None if empty project.
    """
    root = Path(project_path)
    parts = []

    # Extract README content
    for readme_name in ["README.md", "README.rst", "README.txt", "README"]:
        readme = root / readme_name
        if readme.exists():
            try:
                content = readme.read_text(encoding='utf-8', errors='ignore')[:2000]
                if content.strip():
                    parts.append(f"README:\n{content}")
                break
            except Exception as e:
                logger.debug(f"Failed to read {readme_name}: {e}")

    # Extract directory structure (top 2 levels)
    dirs = []
    files = []
    try:
        for item in sorted(root.iterdir()):
            name = item.name
            if name.startswith('.') and name not in ['.github']:
                continue
            if name in BOOTSTRAP_EXCLUDED_DIRS:
                continue
            if item.is_dir():
                # Get immediate children count
                try:
                    child_count = sum(1 for _ in item.iterdir())
                    dirs.append(f"  {name}/ ({child_count} items)")
                except PermissionError:
                    dirs.append(f"  {name}/")
            elif item.is_file() and name in [
                'main.py', 'app.py', 'index.ts', 'index.js', 'main.rs',
                'main.go', 'Makefile', 'Dockerfile', 'docker-compose.yml'
            ]:
                files.append(f"  {name}")
    except Exception as e:
        logger.debug(f"Failed to scan directory: {e}")

    if dirs or files:
        structure = "Directory structure:\n"
        structure += "\n".join(dirs + files)
        parts.append(structure)

    if not parts:
        return None

    return "Architecture overview:\n\n" + "\n\n".join(parts)
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_bootstrap.py::TestExtractArchitecture -v`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add daem0nmcp/server.py tests/test_bootstrap.py
git commit -m "feat(bootstrap): add _extract_architecture extractor"
```

---

## Task 4: Add Conventions Extractor

**Files:**
- Modify: `daem0nmcp/server.py`
- Modify: `tests/test_bootstrap.py`

**Step 1: Write the failing test**

Add to `tests/test_bootstrap.py`:

```python
from daem0nmcp.server import _extract_conventions


class TestExtractConventions:
    """Tests for _extract_conventions extractor."""

    def test_extracts_contributing_guidelines(self, tmp_path):
        """Should extract content from CONTRIBUTING.md."""
        contributing = "# Contributing\n\n## Code Style\nUse 4 spaces for indentation."
        (tmp_path / "CONTRIBUTING.md").write_text(contributing)

        result = _extract_conventions(str(tmp_path))

        assert result is not None
        assert "Code Style" in result

    def test_detects_eslint_config(self, tmp_path):
        """Should detect ESLint configuration."""
        (tmp_path / ".eslintrc.json").write_text('{"extends": "airbnb"}')

        result = _extract_conventions(str(tmp_path))

        assert result is not None
        assert "eslint" in result.lower()

    def test_detects_ruff_config(self, tmp_path):
        """Should detect Ruff configuration."""
        (tmp_path / "ruff.toml").write_text('[tool.ruff]\nline-length = 88')

        result = _extract_conventions(str(tmp_path))

        assert result is not None
        assert "ruff" in result.lower()

    def test_returns_none_when_no_configs(self, tmp_path):
        """Should return None when no convention configs found."""
        result = _extract_conventions(str(tmp_path))
        assert result is None
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_bootstrap.py::TestExtractConventions -v`
Expected: FAIL with `cannot import name '_extract_conventions'`

**Step 3: Write the implementation**

Add to `daem0nmcp/server.py`:

```python
def _extract_conventions(project_path: str) -> Optional[str]:
    """
    Extract coding conventions from config files and docs.

    Checks for:
    1. CONTRIBUTING.md / CONTRIBUTING
    2. Linter configs (.eslintrc, ruff.toml, .pylintrc, etc.)
    3. Formatter configs (.prettierrc, pyproject.toml [tool.black])

    Returns:
        Formatted string with coding conventions, or None if nothing found.
    """
    root = Path(project_path)
    parts = []

    # Check CONTRIBUTING.md
    for contrib_name in ["CONTRIBUTING.md", "CONTRIBUTING.rst", "CONTRIBUTING"]:
        contrib = root / contrib_name
        if contrib.exists():
            try:
                content = contrib.read_text(encoding='utf-8', errors='ignore')[:1500]
                if content.strip():
                    parts.append(f"Contributing guidelines:\n{content}")
                break
            except Exception as e:
                logger.debug(f"Failed to read {contrib_name}: {e}")

    # Detect linter/formatter configs
    config_files = [
        (".eslintrc", "ESLint"),
        (".eslintrc.js", "ESLint"),
        (".eslintrc.json", "ESLint"),
        (".prettierrc", "Prettier"),
        (".prettierrc.json", "Prettier"),
        ("prettier.config.js", "Prettier"),
        ("ruff.toml", "Ruff"),
        (".pylintrc", "Pylint"),
        ("pylintrc", "Pylint"),
        ("mypy.ini", "Mypy"),
        (".flake8", "Flake8"),
        ("setup.cfg", "Setup.cfg"),
        ("tslint.json", "TSLint"),
        ("biome.json", "Biome"),
        (".editorconfig", "EditorConfig"),
    ]

    found_configs = []
    for filename, tool_name in config_files:
        if (root / filename).exists():
            found_configs.append(tool_name)

    # Check pyproject.toml for tool configs
    pyproject = root / "pyproject.toml"
    if pyproject.exists():
        try:
            content = pyproject.read_text(encoding='utf-8', errors='ignore')
            if '[tool.black]' in content:
                found_configs.append("Black")
            if '[tool.ruff]' in content:
                found_configs.append("Ruff")
            if '[tool.mypy]' in content:
                found_configs.append("Mypy")
            if '[tool.pytest]' in content or '[tool.pytest.ini_options]' in content:
                found_configs.append("Pytest")
        except Exception:
            pass

    if found_configs:
        # Deduplicate
        unique_configs = list(dict.fromkeys(found_configs))
        parts.append(f"Code tools configured: {', '.join(unique_configs)}")

    if not parts:
        return None

    return "Coding conventions:\n\n" + "\n\n".join(parts)
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_bootstrap.py::TestExtractConventions -v`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add daem0nmcp/server.py tests/test_bootstrap.py
git commit -m "feat(bootstrap): add _extract_conventions extractor"
```

---

## Task 5: Add Entry Points Extractor

**Files:**
- Modify: `daem0nmcp/server.py`
- Modify: `tests/test_bootstrap.py`

**Step 1: Write the failing test**

Add to `tests/test_bootstrap.py`:

```python
from daem0nmcp.server import _extract_entry_points


class TestExtractEntryPoints:
    """Tests for _extract_entry_points extractor."""

    def test_finds_python_entry_points(self, tmp_path):
        """Should find main.py, app.py, etc."""
        (tmp_path / "main.py").write_text("# main")
        (tmp_path / "src").mkdir()
        (tmp_path / "src" / "app.py").write_text("# app")

        result = _extract_entry_points(str(tmp_path))

        assert result is not None
        assert "main.py" in result

    def test_finds_node_entry_points(self, tmp_path):
        """Should find index.js, index.ts."""
        (tmp_path / "src").mkdir()
        (tmp_path / "src" / "index.ts").write_text("// index")

        result = _extract_entry_points(str(tmp_path))

        assert result is not None
        assert "index.ts" in result

    def test_finds_cli_entry_points(self, tmp_path):
        """Should find cli.py, __main__.py."""
        (tmp_path / "myapp").mkdir()
        (tmp_path / "myapp" / "__main__.py").write_text("# main")
        (tmp_path / "myapp" / "cli.py").write_text("# cli")

        result = _extract_entry_points(str(tmp_path))

        assert result is not None
        assert "__main__.py" in result

    def test_returns_none_when_no_entry_points(self, tmp_path):
        """Should return None when no entry points found."""
        (tmp_path / "utils.py").write_text("# utils")

        result = _extract_entry_points(str(tmp_path))

        assert result is None
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_bootstrap.py::TestExtractEntryPoints -v`
Expected: FAIL with `cannot import name '_extract_entry_points'`

**Step 3: Write the implementation**

Add to `daem0nmcp/server.py`:

```python
def _extract_entry_points(project_path: str) -> Optional[str]:
    """
    Find common entry point files in the project.

    Looks for files like:
    - main.py, app.py, cli.py, __main__.py (Python)
    - index.js, index.ts, main.js, main.ts (Node.js)
    - main.rs (Rust)
    - main.go, cmd/ (Go)
    - server.py, server.js, api.py (Servers)

    Returns:
        Formatted list of entry points found, or None if none found.
    """
    root = Path(project_path)
    entry_point_patterns = [
        "main.py", "app.py", "cli.py", "__main__.py", "server.py", "api.py",
        "wsgi.py", "asgi.py", "manage.py",
        "index.js", "index.ts", "index.tsx", "main.js", "main.ts",
        "server.js", "server.ts", "app.js", "app.ts",
        "main.rs", "lib.rs",
        "main.go",
    ]

    found = []

    def scan_dir(dir_path: Path, depth: int = 0):
        if depth > 2:  # Only scan 2 levels deep
            return
        try:
            for item in dir_path.iterdir():
                if item.name in BOOTSTRAP_EXCLUDED_DIRS:
                    continue
                if item.is_file() and item.name in entry_point_patterns:
                    rel_path = item.relative_to(root)
                    found.append(str(rel_path))
                elif item.is_dir() and not item.name.startswith('.'):
                    scan_dir(item, depth + 1)
        except PermissionError:
            pass

    scan_dir(root)

    # Also check for cmd/ directory (Go convention)
    cmd_dir = root / "cmd"
    if cmd_dir.exists() and cmd_dir.is_dir():
        try:
            for item in cmd_dir.iterdir():
                if item.is_dir():
                    found.append(f"cmd/{item.name}/")
        except PermissionError:
            pass

    if not found:
        return None

    return "Entry points identified:\n" + "\n".join(f"  - {f}" for f in sorted(found)[:15])
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_bootstrap.py::TestExtractEntryPoints -v`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add daem0nmcp/server.py tests/test_bootstrap.py
git commit -m "feat(bootstrap): add _extract_entry_points extractor"
```

---

## Task 6: Add Bootstrap TODO Scanner

**Files:**
- Modify: `daem0nmcp/server.py`
- Modify: `tests/test_bootstrap.py`

**Step 1: Write the failing test**

Add to `tests/test_bootstrap.py`:

```python
from daem0nmcp.server import _scan_todos_for_bootstrap


class TestScanTodosForBootstrap:
    """Tests for _scan_todos_for_bootstrap extractor."""

    def test_finds_todo_comments(self, tmp_path):
        """Should find TODO comments in code files."""
        (tmp_path / "code.py").write_text("# TODO: Fix this later\nx = 1")

        result = _scan_todos_for_bootstrap(str(tmp_path))

        assert result is not None
        assert "TODO" in result
        assert "Fix this later" in result

    def test_finds_fixme_comments(self, tmp_path):
        """Should find FIXME comments."""
        (tmp_path / "code.py").write_text("# FIXME: This is broken\nx = 1")

        result = _scan_todos_for_bootstrap(str(tmp_path))

        assert result is not None
        assert "FIXME" in result

    def test_limits_results(self, tmp_path):
        """Should limit to 20 items."""
        code = "\n".join(f"# TODO: Item {i}" for i in range(30))
        (tmp_path / "code.py").write_text(code)

        result = _scan_todos_for_bootstrap(str(tmp_path), limit=20)

        # Count TODOs in result
        assert result.count("TODO:") <= 20

    def test_returns_none_when_no_todos(self, tmp_path):
        """Should return None when no TODOs found."""
        (tmp_path / "code.py").write_text("x = 1\ny = 2")

        result = _scan_todos_for_bootstrap(str(tmp_path))

        assert result is None
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_bootstrap.py::TestScanTodosForBootstrap -v`
Expected: FAIL with `cannot import name '_scan_todos_for_bootstrap'`

**Step 3: Write the implementation**

Add to `daem0nmcp/server.py`:

```python
def _scan_todos_for_bootstrap(project_path: str, limit: int = 20) -> Optional[str]:
    """
    Scan for TODO/FIXME/HACK comments during bootstrap.

    Uses the existing _scan_for_todos helper but formats results
    for bootstrap memory storage.

    Args:
        project_path: Directory to scan
        limit: Maximum items to include (default: 20)

    Returns:
        Formatted string with TODO summary, or None if none found.
    """
    todos = _scan_for_todos(project_path, max_files=200)

    if not todos:
        return None

    # Limit and format
    limited = todos[:limit]

    # Group by type
    by_type: Dict[str, int] = {}
    for todo in todos:
        todo_type = todo.get('type', 'TODO')
        by_type[todo_type] = by_type.get(todo_type, 0) + 1

    summary_parts = []

    # Add counts summary
    counts = ", ".join(f"{count} {t}" for t, count in sorted(by_type.items()))
    summary_parts.append(f"Found: {counts}")

    # Add individual items
    for todo in limited:
        file_path = todo.get('file', 'unknown')
        line = todo.get('line', 0)
        todo_type = todo.get('type', 'TODO')
        content = todo.get('content', '')[:80]
        summary_parts.append(f"  [{todo_type}] {file_path}:{line} - {content}")

    if len(todos) > limit:
        summary_parts.append(f"  ... and {len(todos) - limit} more")

    return "Known issues from code comments:\n" + "\n".join(summary_parts)
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_bootstrap.py::TestScanTodosForBootstrap -v`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add daem0nmcp/server.py tests/test_bootstrap.py
git commit -m "feat(bootstrap): add _scan_todos_for_bootstrap extractor"
```

---

## Task 7: Update _bootstrap_project_context

**Files:**
- Modify: `daem0nmcp/server.py:853-914`
- Modify: `tests/test_bootstrap.py`

**Step 1: Write the failing test**

Add to `tests/test_bootstrap.py`:

```python
import pytest
from unittest.mock import AsyncMock, MagicMock


class TestBootstrapProjectContext:
    """Integration tests for _bootstrap_project_context."""

    @pytest.mark.asyncio
    async def test_creates_multiple_memories(self, tmp_path):
        """Should create memories for each available source."""
        # Set up project files
        (tmp_path / "package.json").write_text('{"name": "test-app", "description": "Test"}')
        (tmp_path / "README.md").write_text("# Test App\n\nA test application.")
        (tmp_path / "src").mkdir()
        (tmp_path / "src" / "index.ts").write_text("// main")
        (tmp_path / "code.py").write_text("# TODO: Fix this")

        # Mock the context
        mock_memory_manager = AsyncMock()
        mock_memory_manager.remember = AsyncMock(return_value={"id": 1})

        mock_ctx = MagicMock()
        mock_ctx.project_path = str(tmp_path)
        mock_ctx.memory_manager = mock_memory_manager

        from daem0nmcp.server import _bootstrap_project_context
        result = await _bootstrap_project_context(mock_ctx)

        assert result["bootstrapped"] is True
        assert result["memories_created"] >= 3  # At least identity, architecture, entry_points
        assert "sources" in result
        assert result["sources"].get("project_identity") == "ingested"

    @pytest.mark.asyncio
    async def test_graceful_fallback_empty_project(self, tmp_path):
        """Should handle empty project gracefully."""
        mock_memory_manager = AsyncMock()
        mock_memory_manager.remember = AsyncMock(return_value={"id": 1})

        mock_ctx = MagicMock()
        mock_ctx.project_path = str(tmp_path)
        mock_ctx.memory_manager = mock_memory_manager

        from daem0nmcp.server import _bootstrap_project_context
        result = await _bootstrap_project_context(mock_ctx)

        assert result["bootstrapped"] is True
        # Should still work, just with fewer memories
        assert "sources" in result
```

**Step 2: Run test to verify current behavior**

Run: `python -m pytest tests/test_bootstrap.py::TestBootstrapProjectContext -v`
Expected: Tests may pass with old behavior (only 2 memories)

**Step 3: Update the implementation**

Replace `_bootstrap_project_context` in `daem0nmcp/server.py` (lines 853-914):

```python
async def _bootstrap_project_context(ctx: ProjectContext) -> Dict[str, Any]:
    """
    Bootstrap initial context on first run.

    Called automatically when get_briefing() detects no memories exist.
    Ingests multiple sources to provide comprehensive project awareness:
    1. Project identity (tech stack from manifests)
    2. Architecture overview (README + directory structure)
    3. Coding conventions (from config files)
    4. Project instructions (CLAUDE.md, AGENTS.md)
    5. Git history baseline
    6. Known issues (TODO/FIXME scan)
    7. Entry points (main files)

    Args:
        ctx: The project context to bootstrap

    Returns:
        Dictionary with bootstrap results including sources status
    """
    results = {
        "bootstrapped": True,
        "memories_created": 0,
        "sources": {}
    }

    # Define all extractors with their memory configs
    extractors = [
        (
            "project_identity",
            lambda: _extract_project_identity(ctx.project_path),
            "pattern",
            "Tech stack and dependencies from project manifest",
            ["bootstrap", "tech-stack", "identity"]
        ),
        (
            "architecture",
            lambda: _extract_architecture(ctx.project_path),
            "pattern",
            "Project structure and README overview",
            ["bootstrap", "architecture", "structure"]
        ),
        (
            "conventions",
            lambda: _extract_conventions(ctx.project_path),
            "pattern",
            "Coding conventions and tool configurations",
            ["bootstrap", "conventions", "style"]
        ),
        (
            "project_instructions",
            lambda: _extract_project_instructions(ctx.project_path),
            "pattern",
            "Project-specific AI instructions from CLAUDE.md/AGENTS.md",
            ["bootstrap", "project-config", "instructions"]
        ),
        (
            "git_evolution",
            lambda: _get_git_history_summary(ctx.project_path, limit=30),
            "learning",
            "Recent git history showing project evolution",
            ["bootstrap", "git-history", "evolution"]
        ),
        (
            "known_issues",
            lambda: _scan_todos_for_bootstrap(ctx.project_path, limit=20),
            "warning",
            "Known issues from TODO/FIXME/HACK comments in code",
            ["bootstrap", "tech-debt", "issues"]
        ),
        (
            "entry_points",
            lambda: _extract_entry_points(ctx.project_path),
            "learning",
            "Main entry point files identified in the project",
            ["bootstrap", "entry-points", "structure"]
        ),
    ]

    # Run each extractor and create memories
    for name, extractor, category, rationale, tags in extractors:
        try:
            content = extractor()
            if content:
                await ctx.memory_manager.remember(
                    category=category,
                    content=content,
                    rationale=f"Auto-ingested on first run: {rationale}",
                    tags=tags,
                    project_path=ctx.project_path
                )
                results["sources"][name] = "ingested"
                results["memories_created"] += 1
                logger.info(f"Bootstrapped {name} for {ctx.project_path}")
            else:
                results["sources"][name] = "skipped"
        except Exception as e:
            logger.warning(f"Failed to extract {name}: {e}")
            results["sources"][name] = f"error: {e}"

    return results
```

**Step 4: Add the project instructions extractor**

Add this helper before `_bootstrap_project_context`:

```python
def _extract_project_instructions(project_path: str) -> Optional[str]:
    """
    Extract project instructions from CLAUDE.md and AGENTS.md.

    Returns:
        Combined instructions content, or None if no files found.
    """
    root = Path(project_path)
    parts = []

    # Check CLAUDE.md
    claude_md = root / "CLAUDE.md"
    if claude_md.exists():
        try:
            content = claude_md.read_text(encoding='utf-8', errors='ignore')[:3000]
            if content.strip():
                parts.append(f"From CLAUDE.md:\n{content}")
        except Exception as e:
            logger.debug(f"Failed to read CLAUDE.md: {e}")

    # Check AGENTS.md
    agents_md = root / "AGENTS.md"
    if agents_md.exists():
        try:
            content = agents_md.read_text(encoding='utf-8', errors='ignore')[:2000]
            if content.strip():
                parts.append(f"From AGENTS.md:\n{content}")
        except Exception as e:
            logger.debug(f"Failed to read AGENTS.md: {e}")

    if not parts:
        return None

    return "Project instructions:\n\n" + "\n\n".join(parts)
```

**Step 5: Run tests to verify it passes**

Run: `python -m pytest tests/test_bootstrap.py -v`
Expected: All tests PASS

**Step 6: Run full test suite**

Run: `python -m pytest tests/ -v --tb=short`
Expected: All 157+ tests PASS

**Step 7: Commit**

```bash
git add daem0nmcp/server.py tests/test_bootstrap.py
git commit -m "feat(bootstrap): integrate all extractors into _bootstrap_project_context"
```

---

## Task 8: Update get_briefing Message Format

**Files:**
- Modify: `daem0nmcp/server.py` (in get_briefing function, ~line 1000)

**Step 1: Find the message generation code**

Search for where the briefing message is constructed (look for "BOOTSTRAP" in the message).

**Step 2: Update the message format**

In `get_briefing()`, update the message construction to include source details:

```python
# After bootstrap, create enhanced message
if bootstrap_result:
    sources = bootstrap_result.get("sources", {})
    ingested = [k for k, v in sources.items() if v == "ingested"]

    if ingested:
        source_summary = ", ".join(ingested)
        message = (
            f"Daem0nMCP ready. {stats.get('total_memories', 0)} memories stored. "
            f"[BOOTSTRAP] First run - ingested: {source_summary}"
        )
    else:
        message = (
            f"Daem0nMCP ready. {stats.get('total_memories', 0)} memories stored. "
            f"[BOOTSTRAP] First run - no sources found"
        )
```

**Step 3: Run tests**

Run: `python -m pytest tests/ -v --tb=short`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add daem0nmcp/server.py
git commit -m "feat(bootstrap): enhance briefing message with source details"
```

---

## Task 9: Final Integration Test

**Files:**
- Modify: `tests/test_bootstrap.py`

**Step 1: Write integration test**

Add to `tests/test_bootstrap.py`:

```python
class TestBootstrapIntegration:
    """End-to-end integration tests for bootstrap."""

    @pytest.mark.asyncio
    async def test_full_bootstrap_flow(self, tmp_path):
        """Test complete bootstrap with real files."""
        # Create a realistic project structure
        (tmp_path / "package.json").write_text(
            '{"name": "my-app", "description": "A cool app", "dependencies": {"react": "^18.0.0"}}'
        )
        (tmp_path / "README.md").write_text(
            "# My App\n\nA cool application for doing things.\n\n## Installation\n\nnpm install"
        )
        (tmp_path / "src").mkdir()
        (tmp_path / "src" / "index.ts").write_text("// Entry point\nexport const main = () => {}")
        (tmp_path / "src" / "utils.ts").write_text("// TODO: Add more utils\nexport const helper = () => {}")
        (tmp_path / ".eslintrc.json").write_text('{"extends": "next"}')
        (tmp_path / "CLAUDE.md").write_text("# Project Instructions\n\nUse TypeScript.")

        # Initialize git repo (needed for git history)
        import subprocess
        subprocess.run(["git", "init"], cwd=tmp_path, capture_output=True)
        subprocess.run(["git", "config", "user.email", "test@test.com"], cwd=tmp_path, capture_output=True)
        subprocess.run(["git", "config", "user.name", "Test"], cwd=tmp_path, capture_output=True)
        subprocess.run(["git", "add", "."], cwd=tmp_path, capture_output=True)
        subprocess.run(["git", "commit", "-m", "Initial commit"], cwd=tmp_path, capture_output=True)

        # Run extractors directly to verify
        from daem0nmcp.server import (
            _extract_project_identity,
            _extract_architecture,
            _extract_conventions,
            _extract_project_instructions,
            _extract_entry_points,
            _scan_todos_for_bootstrap,
        )

        identity = _extract_project_identity(str(tmp_path))
        assert identity is not None
        assert "my-app" in identity

        architecture = _extract_architecture(str(tmp_path))
        assert architecture is not None
        assert "My App" in architecture

        conventions = _extract_conventions(str(tmp_path))
        assert conventions is not None
        assert "ESLint" in conventions

        instructions = _extract_project_instructions(str(tmp_path))
        assert instructions is not None
        assert "TypeScript" in instructions

        entry_points = _extract_entry_points(str(tmp_path))
        assert entry_points is not None
        assert "index.ts" in entry_points

        todos = _scan_todos_for_bootstrap(str(tmp_path))
        assert todos is not None
        assert "TODO" in todos
```

**Step 2: Run integration test**

Run: `python -m pytest tests/test_bootstrap.py::TestBootstrapIntegration -v`
Expected: PASS

**Step 3: Run full test suite**

Run: `python -m pytest tests/ -v`
Expected: All tests PASS (should be ~165+ tests now)

**Step 4: Commit**

```bash
git add tests/test_bootstrap.py
git commit -m "test(bootstrap): add integration tests for enhanced bootstrap"
```

---

## Task 10: Final Verification and Merge Prep

**Step 1: Run full test suite**

Run: `python -m pytest tests/ -v --tb=short`
Expected: All tests PASS

**Step 2: Check for linting issues**

Run: `python -m ruff check daem0nmcp/server.py`
Expected: No errors (or fix any that appear)

**Step 3: Create summary commit if needed**

If any small fixes were made:
```bash
git add -A
git commit -m "chore: cleanup and polish enhanced bootstrap"
```

**Step 4: Ready for PR**

The feature branch is now ready. Use `superpowers:finishing-a-development-branch` to complete.
