"""
Test script for DevilMCP Server - MCP-Safe Version
Validates that all modules and tools work correctly.

IMPORTANT: This version uses logging instead of print to avoid 
interfering with MCP JSON-RPC communication over stdio.
"""

import os
import sys
import tempfile
import logging
from pathlib import Path

# Only import the modules, don't execute anything on import
from context_manager import ContextManager
from decision_tracker import DecisionTracker
from change_analyzer import ChangeAnalyzer
from cascade_detector import CascadeDetector
from thought_processor import ThoughtProcessor

# Configure logging to use stderr and file (not stdout to avoid MCP interference)
logging.basicConfig(
    level=logging.INFO,
    format='%(message)s',
    handlers=[
        logging.FileHandler('test_results.log'),
        logging.StreamHandler(sys.stderr)  # Use stderr to avoid MCP stdio interference
    ]
)
logger = logging.getLogger(__name__)


def test_context_manager():
    """Test context manager functionality."""
    logger.info("Testing Context Manager...")

    with tempfile.TemporaryDirectory() as tmpdir:
        ctx = ContextManager(tmpdir)
        current_dir = Path(__file__).parent
        structure = ctx.analyze_project_structure(str(current_dir))
        
        assert "root" in structure
        assert "total_files" in structure
        assert structure["total_files"] > 0
        logger.info(f"✓ Context Manager: Found {structure['total_files']} files")

    return True


def test_decision_tracker():
    """Test decision tracker functionality."""
    logger.info("Testing Decision Tracker...")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        dt = DecisionTracker(tmpdir)
        decision = dt.log_decision(
            decision="Use JWT for authentication",
            rationale="Stateless and scalable",
            context={"project": "test"},
            alternatives_considered=["Sessions", "OAuth2"],
            expected_impact="Improved scalability",
            risk_level="medium",
            tags=["auth", "security"]
        )
        
        assert decision["id"] == 1
        logger.info(f"✓ Decision Tracker: Logged decision #{decision['id']}")

    return True


def test_change_analyzer():
    """Test change analyzer functionality.""" 
    logger.info("Testing Change Analyzer...")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        ca = ChangeAnalyzer(tmpdir)
        change = ca.log_change(
            file_path="/test/file.py",
            change_type="modify", 
            description="Update authentication logic",
            rationale="Security improvement",
            affected_components=["auth", "api"],
            rollback_plan="Revert commit"
        )
        
        assert change["id"] == 1
        logger.info(f"✓ Change Analyzer: Logged change #{change['id']}")

    return True


def test_cascade_detector():
    """Test cascade detector functionality."""
    logger.info("Testing Cascade Detector...")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        cd = CascadeDetector(tmpdir)
        risk = cd.analyze_cascade_risk(
            target="/test/file.py",
            change_type="breaking"
        )
        
        assert "cascade_probability" in risk
        logger.info(f"✓ Cascade Detector: Risk level {risk['risk_level']}")

    return True


def test_thought_processor():
    """Test thought processor functionality."""
    logger.info("Testing Thought Processor...")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        tp = ThoughtProcessor(tmpdir)
        session = tp.start_session(
            session_id="test-session",
            context={"task": "Test task"}
        )
        
        assert session["id"] == "test-session"
        logger.info(f"✓ Thought Processor: Started session {session['id']}")

    return True


def run_all_tests():
    """Run all tests with MCP-safe logging."""
    logger.info("=" * 50)
    logger.info("DevilMCP Server Test Suite (MCP-Safe)")
    logger.info("=" * 50)

    try:
        test_context_manager()
        test_decision_tracker() 
        test_change_analyzer()
        test_cascade_detector()
        test_thought_processor()

        logger.info("=" * 50)
        logger.info("🎉 ALL TESTS PASSED! 🎉")
        logger.info("DevilMCP Server is ready to use!")
        logger.info("=" * 50)
        return True

    except Exception as e:
        logger.error(f"❌ TEST FAILED: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False


if __name__ == "__main__":
    # Only run tests when executed directly, not when imported
    success = run_all_tests()
    sys.exit(0 if success else 1)
