# Firecrawl Nightly Crawl Update

## Overview
Updated the nightly crawl system to use Firecrawl instead of the old scraper system that was failing due to anti-bot protection and code compatibility issues.

## Changes Made

### 1. Updated GitHub Actions Workflow
- **File**: `.github/workflows/crawl-retailers.yml`
- **Changes**:
  - Added Firecrawl SDK installation: `pip install firecrawl-py`
  - Added `FIRECRAWL_API_KEY` environment variable
  - Replaced individual retailer calls with `run_firecrawl_all.py`
  - Added results artifact upload for debugging

### 2. Created New Firecrawl Runner Script
- **File**: `backend/scrapers/crawl4ai_scrapers/run_firecrawl_all.py`
- **Purpose**: Run Firecrawl for all retailers in sequence efficiently
- **Features**:
  - Processes all 6 retailers: Checkers, Shoprite, PicknPay, Makro, Woolworths, PriceCheck
  - Configurable product limits per retailer
  - JSON output for results tracking
  - Error handling for individual retailer failures

### 3. Environment Variables Required
The GitHub Actions workflow now requires:
- `FIRECRAWL_API_KEY`: Your Firecrawl API key (add as GitHub secret)
- `FIREBASE_PUSH`: Set to 'true' to push results to Firestore
- `GOOGLE_APPLICATION_CREDENTIALS`: Firebase service account (existing)

## Setup Instructions

### 1. Add Firecrawl API Key to GitHub Secrets
1. Go to your GitHub repository
2. Navigate to Settings → Secrets and variables → Actions
3. Add a new secret named `FIRECRAWL_API_KEY`
4. Set the value to your Firecrawl API key

### 2. Test Locally (Optional)
```bash
cd backend/scrapers/crawl4ai_scrapers
export FIRECRAWL_API_KEY="your_api_key_here"
python3 run_firecrawl_all.py --limit 50 --output test_results.json
```

## Expected Results

### Success Indicators
- GitHub Actions workflow runs successfully at 2:00 AM UTC daily
- Products are extracted and stored in SQLite database
- Results are pushed to Firestore (if enabled)
- Results artifact is uploaded for inspection

### Monitoring
- Check GitHub Actions tab for workflow runs
- Download `firecrawl-results` artifact to see detailed results
- Monitor Firestore for new product data

## Troubleshooting

### Common Issues
1. **Missing FIRECRAWL_API_KEY**: Add the secret to GitHub repository
2. **Firecrawl SDK not installed**: Ensure `firecrawl-py` is in requirements.txt
3. **Database errors**: Check if data directory exists and is writable

### Debugging
- Check GitHub Actions logs for detailed error messages
- Download and inspect the results artifact
- Test locally with a small limit first

## Benefits of Firecrawl
- **Bypasses anti-bot protection** that was blocking the old scrapers
- **More reliable** than browser-based scraping
- **Better rate limiting** built into the SDK
- **Structured data extraction** using LLM capabilities
- **No browser dependencies** in CI environment 