# devilmcp/executor.py
"""
Tool Executor Interface
Defines the contract for all tool execution strategies.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional, Dict, List


@dataclass
class ExecutionResult:
    """Result of executing a tool command."""
    success: bool
    output: str
    error: Optional[str] = None
    return_code: Optional[int] = None
    timed_out: bool = False
    executor_type: str = "subprocess"


class ToolExecutor(ABC):
    """Base interface for all tool execution strategies."""

    @abstractmethod
    async def execute(
        self,
        command: str,
        args: List[str],
        env: Optional[Dict[str, str]] = None
    ) -> ExecutionResult:
        """Execute a command and return the result."""
        pass

    @abstractmethod
    async def cleanup(self) -> None:
        """Release any resources held by the executor."""
        pass
