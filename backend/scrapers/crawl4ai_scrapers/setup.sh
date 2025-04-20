#!/bin/bash

# Setup script for crawl4ai scrapers
# This script installs the required Python dependencies and sets up the crawl4ai environment

echo "Setting up crawl4ai scrapers..."

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "Python 3 is not installed. Please install Python 3 and try again."
    exit 1
fi

# Create a virtual environment (optional but recommended)
echo "Creating Python virtual environment..."
python3 -m venv venv

# Activate the virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install the required Python packages
echo "Installing required Python packages..."
pip install -r requirements.txt

# Run the post-installation setup for crawl4ai
echo "Running crawl4ai setup..."
python -m crawl4ai.cli.setup

# Verify the installation
echo "Verifying installation..."
python -m crawl4ai.cli.doctor

echo "Setup complete!"
echo "To activate the virtual environment in the future, run: source venv/bin/activate" 