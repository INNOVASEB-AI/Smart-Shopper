#!/bin/bash
# Setup script for Smart Shopper ZA Scrapy integration

# Set up virtual environment
echo "Setting up virtual environment..."
python -m venv venv
source venv/bin/activate

# Install Python dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Install Playwright browsers
echo "Installing Playwright browsers..."
playwright install chromium

# Create data directories
echo "Creating data directories..."
mkdir -p data/crawl_output
mkdir -p data/backups

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
  echo "Creating .env file..."
  cat > .env << EOF
# Scrapy configuration
USE_SCRAPY=true
DATABASE_URL=sqlite:///./data/products.db
API_ENDPOINT=http://localhost:3001/api/products/batch
OUTPUT_DIR=./data/crawl_output
EOF
fi

echo "Setup complete! To activate the virtual environment, run:"
echo "source venv/bin/activate" 