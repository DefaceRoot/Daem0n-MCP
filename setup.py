"""
Setup script for Daem0nMCP
"""

from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

with open("requirements.txt", "r", encoding="utf-8") as fh:
    requirements = [line.strip() for line in fh if line.strip() and not line.startswith("#")]

setup(
    name="daem0nmcp",
    version="2.2.0",
    author="Daem0nMCP",
    description="Extremely powerful MCP server for AI agent context management",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/DasBluEyedDevil/Daem0n-MCP",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
    python_requires=">=3.8",
    install_requires=requirements,
    entry_points={
        "console_scripts": [
            "daem0nmcp=daem0nmcp.server:main",
        ],
    },
)
