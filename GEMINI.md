# DevilMCP Project Context

## Overview
DevilMCP is an advanced **Context Management System** and **MCP (Model Context Protocol) Server** designed for AI agents. It serves as a "long-term memory" and project manager, enabling AI assistants to track decisions, analyze code impact, and manage tasks across sessions. It features a modular architecture backed by SQLite and includes web browsing capabilities via Playwright.

## Key Features
*   **Context Management:** `devilmcp.context_manager` tracks project structure and file dependencies.
*   **Decision Tracking:** `devilmcp.decision_tracker` logs architectural decisions and rationales.
*   **Change Analysis:** `devilmcp.change_analyzer` predicts the impact of code changes ("blast radius").
*   **Cascade Detection:** `devilmcp.cascade_detector` identifies potential cascade failures from changes.
*   **Task Management:** `devilmcp.task_manager` handles todo lists and project tasks.
*   **Browser Automation:** `devilmcp.browser` allows the agent to navigate and extract web content.
*   **Tool Registry:** `devilmcp.tool_registry` manages external CLI tools that the agent can invoke.

## Architecture
The project is a Python package structured as follows:
*   **`devilmcp/server.py`**: The main entry point. Initializes the `FastMCP` server and exposes all tools.
*   **`devilmcp/database.py`**: Handles SQLite database connections using `aiosqlite` and `sqlalchemy`.
*   **`devilmcp/models.py`**: SQLAlchemy models defining the data schema (Decisions, Tasks, Tools, etc.).
*   **`.devilmcp/`**: Default directory for storing the project-specific SQLite database (`devilmcp.db`).

## Setup & Usage

### Installation
The project is designed for editable installation:
```bash
pip install -e .
playwright install  # Required for browser tools
```

### Running the Server
The server can be started directly:
```bash
python -m devilmcp.server
```
Or via the installed console script:
```bash
devilmcp
```

### AI Integration
The primary use case is integration with AI clients (Claude Desktop, Cursor, Windsurf) via their MCP configuration.
*   **Config Path:** `mcpServers` in `claude_desktop_config.json` (or equivalent).
*   **Command:** `python -m devilmcp.server`

Refer to `AI_INSTRUCTIONS.md` for the autonomous setup protocol used by AI agents.

## Development Conventions
*   **Language:** Python 3.8+
*   **Async/Await:** Extensive use of `asyncio` for non-blocking operations.
*   **Type Hinting:** All functions and methods are fully type-hinted.
*   **Logging:** Standard Python `logging` is used for tracking server activity.
*   **Testing:** Uses `pytest` and `pytest-asyncio` (dependencies in `requirements.txt`).

## Key Files
*   `AI_INSTRUCTIONS.md`: Self-contained instructions for AI agents to install and configure DevilMCP.
*   `tools.toml.example`: Example configuration for registering custom CLI tools.
*   `devilmcp/tool_registry.py`: Logic for managing and executing external tools.
