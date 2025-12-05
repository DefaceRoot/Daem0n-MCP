# tests/test_integration.py
"""
Integration tests for the ToolExecutor system.

These tests verify the complete flow from ToolRegistry to execution,
testing real-world scenarios across different executor types.
"""

import pytest
import tempfile
import subprocess
from pathlib import Path
from unittest.mock import MagicMock, AsyncMock


@pytest.mark.asyncio
async def test_full_tool_execution_flow():
    """Test the complete flow from ToolRegistry to execution."""
    from devilmcp.tool_registry import ToolRegistry, ToolConfig

    # Setup mock DB
    mock_db = MagicMock()
    mock_db.get_session = MagicMock(return_value=AsyncMock())

    registry = ToolRegistry(mock_db)

    # Register a test tool
    registry._tools_cache["test-echo"] = ToolConfig(
        name="test-echo",
        display_name="Test Echo",
        command="echo",
        args=[],
        capabilities=[],
        enabled=True,
        config={},
        prompt_patterns=[],
        init_timeout=5000,
        command_timeout=10000,
        max_context_size=None,
        supports_streaming=False
    )

    # Execute
    result = await registry.execute_tool("test-echo", "echo", ["integration", "test"])

    assert result.success is True
    assert "integration test" in result.output
    assert result.executor_type == "subprocess-stateless"

    # Cleanup
    await registry.cleanup_executors()


@pytest.mark.asyncio
async def test_git_native_executor_in_real_repo(tmp_path):
    """Test GitNativeExecutor with a real git repo."""
    from devilmcp.native_executors.git import GitNativeExecutor

    # Create temp repo
    subprocess.run(["git", "init"], cwd=tmp_path, capture_output=True, check=True)
    subprocess.run(["git", "config", "user.email", "test@test.com"], cwd=tmp_path, capture_output=True, check=True)
    subprocess.run(["git", "config", "user.name", "Test"], cwd=tmp_path, capture_output=True, check=True)
    subprocess.run(["git", "config", "commit.gpgsign", "false"], cwd=tmp_path, capture_output=True, check=True)
    (tmp_path / "file.txt").write_text("content")
    subprocess.run(["git", "add", "."], cwd=tmp_path, capture_output=True, check=True)
    subprocess.run(["git", "commit", "-m", "init"], cwd=tmp_path, capture_output=True, check=True)

    executor = GitNativeExecutor(str(tmp_path))

    # Test status
    result = await executor.execute("status", [])
    assert result.success is True
    assert result.executor_type == "native-git"

    await executor.cleanup()


@pytest.mark.asyncio
async def test_subprocess_executor_stateless_with_echo():
    """Test SubprocessExecutor in stateless mode with echo command."""
    from devilmcp.subprocess_executor import SubprocessExecutor
    from devilmcp.tool_registry import ToolConfig

    config = ToolConfig(
        name="echo-test",
        display_name="Echo Test",
        command="echo",
        args=[],
        capabilities=[],
        enabled=True,
        config={},
        prompt_patterns=[],  # Empty = stateless
        init_timeout=5000,
        command_timeout=10000,
        max_context_size=None,
        supports_streaming=False
    )

    executor = SubprocessExecutor(config)

    # Test multiple executions
    result1 = await executor.execute("echo", ["first", "execution"])
    assert result1.success is True
    assert "first execution" in result1.output

    result2 = await executor.execute("echo", ["second", "execution"])
    assert result2.success is True
    assert "second execution" in result2.output

    await executor.cleanup()


@pytest.mark.asyncio
async def test_registry_routes_to_correct_executor():
    """Test that ToolRegistry routes to the appropriate executor type."""
    from devilmcp.tool_registry import ToolRegistry, ToolConfig
    from devilmcp.subprocess_executor import SubprocessExecutor

    mock_db = MagicMock()
    mock_db.get_session = MagicMock(return_value=AsyncMock())

    registry = ToolRegistry(mock_db)

    # Add stateless tool
    registry._tools_cache["echo"] = ToolConfig(
        name="echo",
        display_name="Echo",
        command="echo",
        args=[],
        capabilities=[],
        enabled=True,
        config={},
        prompt_patterns=[],
        init_timeout=5000,
        command_timeout=10000,
        max_context_size=None,
        supports_streaming=False
    )

    # Get executor and verify type
    executor = await registry.get_executor("echo")
    assert isinstance(executor, SubprocessExecutor)

    # Verify it's cached
    executor2 = await registry.get_executor("echo")
    assert executor is executor2

    await registry.cleanup_executors()


@pytest.mark.asyncio
async def test_error_handling_for_unknown_tool():
    """Test that executing an unknown tool returns a proper error."""
    from devilmcp.tool_registry import ToolRegistry

    mock_db = MagicMock()
    mock_db.get_session = MagicMock(return_value=AsyncMock())

    registry = ToolRegistry(mock_db)

    result = await registry.execute_tool("nonexistent-tool", "test", [])

    assert result.success is False
    assert "not found" in result.error.lower()


@pytest.mark.asyncio
async def test_stateful_executor_maintains_session():
    """Test that stateful executor maintains state across commands."""
    from devilmcp.subprocess_executor import SubprocessExecutor
    from devilmcp.tool_registry import ToolConfig

    config = ToolConfig(
        name="python-repl",
        display_name="Python REPL",
        command="python",
        args=["-i"],
        capabilities=[],
        enabled=True,
        config={},
        prompt_patterns=[">>> "],  # Has patterns = stateful
        init_timeout=5000,
        command_timeout=10000,
        max_context_size=None,
        supports_streaming=False
    )

    executor = SubprocessExecutor(config)

    # Set a variable
    result1 = await executor.execute("x = 123", [])
    assert result1.executor_type == "subprocess-stateful"

    # Read it back - this only works if session is maintained
    result2 = await executor.execute("print(x)", [])
    assert "123" in result2.output

    await executor.cleanup()


@pytest.mark.asyncio
async def test_git_executor_multiple_commands(tmp_path):
    """Test GitNativeExecutor with multiple sequential commands."""
    from devilmcp.native_executors.git import GitNativeExecutor

    # Setup git repo
    subprocess.run(["git", "init"], cwd=tmp_path, capture_output=True, check=True)
    subprocess.run(["git", "config", "user.email", "test@test.com"], cwd=tmp_path, capture_output=True, check=True)
    subprocess.run(["git", "config", "user.name", "Test"], cwd=tmp_path, capture_output=True, check=True)
    subprocess.run(["git", "config", "commit.gpgsign", "false"], cwd=tmp_path, capture_output=True, check=True)

    executor = GitNativeExecutor(str(tmp_path))

    # Test status on clean repo
    result1 = await executor.execute("status", [])
    assert result1.success is True

    # Create and add a file
    (tmp_path / "test.txt").write_text("hello")
    result2 = await executor.execute("add", ["test.txt"])
    assert result2.success is True

    # Commit the file
    result3 = await executor.execute("commit", ["-m", "test commit"])
    assert result3.success is True

    # Check log
    result4 = await executor.execute("log", ["--oneline", "-1"])
    assert result4.success is True
    assert "test commit" in result4.output

    await executor.cleanup()


@pytest.mark.asyncio
async def test_registry_cleanup_cleans_all_executors():
    """Test that registry cleanup properly cleans all cached executors."""
    from devilmcp.tool_registry import ToolRegistry, ToolConfig

    mock_db = MagicMock()
    mock_db.get_session = MagicMock(return_value=AsyncMock())

    registry = ToolRegistry(mock_db)

    # Add multiple tools
    for i in range(3):
        registry._tools_cache[f"echo-{i}"] = ToolConfig(
            name=f"echo-{i}",
            display_name=f"Echo {i}",
            command="echo",
            args=[],
            capabilities=[],
            enabled=True,
            config={},
            prompt_patterns=[],
            init_timeout=5000,
            command_timeout=10000,
            max_context_size=None,
            supports_streaming=False
        )

    # Create executors
    await registry.get_executor("echo-0")
    await registry.get_executor("echo-1")
    await registry.get_executor("echo-2")

    assert len(registry._executors) == 3

    # Cleanup
    await registry.cleanup_executors()

    assert len(registry._executors) == 0


@pytest.mark.asyncio
async def test_execution_result_contains_all_expected_fields():
    """Test that ExecutionResult from real execution has all expected fields."""
    from devilmcp.tool_registry import ToolRegistry, ToolConfig

    mock_db = MagicMock()
    mock_db.get_session = MagicMock(return_value=AsyncMock())

    registry = ToolRegistry(mock_db)

    registry._tools_cache["echo"] = ToolConfig(
        name="echo",
        display_name="Echo",
        command="echo",
        args=[],
        capabilities=[],
        enabled=True,
        config={},
        prompt_patterns=[],
        init_timeout=5000,
        command_timeout=10000,
        max_context_size=None,
        supports_streaming=False
    )

    result = await registry.execute_tool("echo", "echo", ["test"])

    # Verify all fields are present
    assert hasattr(result, 'success')
    assert hasattr(result, 'output')
    assert hasattr(result, 'error')
    assert hasattr(result, 'return_code')
    assert hasattr(result, 'timed_out')
    assert hasattr(result, 'executor_type')

    # Verify values
    assert result.success is True
    assert result.timed_out is False
    assert result.executor_type == "subprocess-stateless"

    await registry.cleanup_executors()


@pytest.mark.asyncio
async def test_subprocess_executor_handles_command_failure():
    """Test that SubprocessExecutor properly handles command failures."""
    from devilmcp.subprocess_executor import SubprocessExecutor
    from devilmcp.tool_registry import ToolConfig

    config = ToolConfig(
        name="python-test",
        display_name="Python Test",
        command="python",
        args=[],
        capabilities=[],
        enabled=True,
        config={},
        prompt_patterns=[],
        init_timeout=5000,
        command_timeout=10000,
        max_context_size=None,
        supports_streaming=False
    )

    executor = SubprocessExecutor(config)

    # Execute a command that fails
    result = await executor.execute("python", ["-c", "exit(42)"])

    assert result.success is False
    assert result.return_code == 42
    assert result.executor_type == "subprocess-stateless"

    await executor.cleanup()
