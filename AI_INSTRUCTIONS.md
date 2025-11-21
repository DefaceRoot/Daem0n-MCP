# DevilMCP Integration Instructions for AI Assistants

You are integrated with **DevilMCP**, a powerful Context Management System designed to act as your long-term memory and project manager.

## 🚨 CRITICAL RULES

1.  **ALWAYS CHECK CONTEXT FIRST**: Before answering questions about the codebase or starting a task, run `get_project_context()` to ground yourself.
2.  **LOG EVERY DECISION**: If you make an architectural choice (e.g., "Let's use library X"), you MUST use `log_decision()` immediately. Do not wait for the user to ask.
3.  **PREDICT BEFORE CHANGING**: Before writing code that modifies existing files, run `analyze_change_impact()` to see what might break.
4.  **MANAGE TASKS**: If the user gives you a complex goal, break it down and use `create_task()` to track it.

## 🛠️ Your Toolset

### 1. Context & Memory
*   `get_project_context()`: Get a high-level map of the project structure.
*   `search_context(query="...")`: Find specific info (e.g., "where is auth logic?").
*   `track_file_dependencies(file_path="...")`: See what imports a file (critical before refactoring).

### 2. Decision Making (The "Brain")
*   `log_decision(decision="...", rationale="...")`: Record *why* you did something.
    *   *Example:* `log_decision("Use Pytest", "Better fixture support than unittest")`
*   `query_decisions(query="...")`: Ask "Why did we do this?" to see past decisions.

### 3. Task Management (The "Project Manager")
*   `create_task(title="...", priority="high")`: Create a new todo item.
*   `list_tasks(status="todo")`: See what you need to do next.
*   `update_task(task_id=..., status="done")`: Mark work as complete.

### 4. Safety Checks
*   `analyze_change_impact(file_path="...", description="...")`: Ask "Is this safe?"
*   `suggest_safe_changes(target="...", proposed_change="...")`: Ask "How should I do this safely?"

## 💡 Workflow Example

**User:** "Refactor the user login to use JWT."

**Your Internal Monologue:**
1.  *I need to understand the current login first.* -> `search_context("login")`
2.  *I should create a tracking task.* -> `create_task("Refactor Login to JWT", priority="high")`
3.  *I found `login.py`. Who uses it?* -> `track_file_dependencies("login.py")`
4.  *Okay, I'm replacing Session with JWT. I'll log this.* -> `log_decision("Switch to JWT", "Stateless scaling")`
5.  *Now I'll write the code...*
6.  *Done. Task complete.* -> `update_task(id=1, status="done")`

**Start every session by checking `list_tasks()` to see if there is unfinished work.**
