"""
Browser Automation Module
Provides tools for interacting with web pages using Playwright.
"""

import logging
import base64
from typing import Dict, List, Optional, Any
from playwright.async_api import async_playwright, Browser, BrowserContext, Page, Playwright

logger = logging.getLogger(__name__)

class BrowserManager:
    """Manages browser lifecycle and interaction tools."""

    def __init__(self):
        self.playwright: Optional[Playwright] = None
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self._active = False

    async def _ensure_browser(self):
        """Initialize browser if not already running."""
        if not self._active:
            logger.info("Initializing Playwright browser...")
            try:
                self.playwright = await async_playwright().start()
                # Launch chromium by default. 
                # Headless=True is standard for backend agents.
                self.browser = await self.playwright.chromium.launch(headless=True)
                self.context = await self.browser.new_context(
                    user_agent="DevilMCP/1.0 (AI Agent)",
                    viewport={"width": 1280, "height": 720}
                )
                self.page = await self.context.new_page()
                self._active = True
                logger.info("Browser initialized successfully.")
            except Exception as e:
                logger.error(f"Failed to initialize browser: {e}")
                await self.cleanup()
                raise RuntimeError(f"Could not start browser: {e}. Make sure to run 'playwright install'.")

    async def cleanup(self):
        """Clean up browser resources."""
        if self.page:
            await self.page.close()
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
        
        self.page = None
        self.context = None
        self.browser = None
        self.playwright = None
        self._active = False
        logger.info("Browser resources cleaned up.")

    async def navigate(self, url: str) -> str:
        """Navigate to a URL."""
        await self._ensure_browser()
        logger.info(f"Navigating to {url}")
        try:
            response = await self.page.goto(url, wait_until="domcontentloaded")
            status = response.status if response else "unknown"
            return f"Navigated to {url} (Status: {status})"
        except Exception as e:
            return f"Navigation failed: {str(e)}"

    async def get_content(self, format_type: str = "text") -> str:
        """
        Get page content.
        modes: 'text', 'html', 'markdown', 'accessibility'
        """
        await self._ensure_browser()
        if not self.page:
            return "Error: No active page."

        try:
            if format_type == "html":
                return await self.page.content()
            elif format_type == "accessibility":
                snapshot = await self.page.accessibility.snapshot()
                return str(snapshot)
            else:
                # Default to visible text
                return await self.page.evaluate("document.body.innerText")
        except Exception as e:
            return f"Error getting content: {str(e)}"

    async def click(self, selector: str) -> str:
        """Click an element specified by selector."""
        await self._ensure_browser()
        try:
            await self.page.click(selector)
            return f"Clicked element: {selector}"
        except Exception as e:
            return f"Click failed: {str(e)}"

    async def type_text(self, selector: str, text: str) -> str:
        """Type text into an element."""
        await self._ensure_browser()
        try:
            await self.page.fill(selector, text)
            return f"Typed '{text}' into {selector}"
        except Exception as e:
            return f"Typing failed: {str(e)}"

    async def screenshot(self) -> Dict[str, str]:
        """Take a screenshot and return as base64."""
        await self._ensure_browser()
        try:
            screenshot_bytes = await self.page.screenshot()
            b64_img = base64.b64encode(screenshot_bytes).decode('utf-8')
            return {
                "type": "image",
                "data": b64_img,
                "mime_type": "image/png"
            }
        except Exception as e:
            return {"error": f"Screenshot failed: {str(e)}"}

    async def run_script(self, script: str) -> str:
        """Execute JavaScript on the page."""
        await self._ensure_browser()
        try:
            result = await self.page.evaluate(script)
            return str(result)
        except Exception as e:
            return f"Script execution failed: {str(e)}"
