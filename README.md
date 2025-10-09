# Ethereum PR Scheduler & Analytics

Automated system that fetches, processes, and analyzes Pull Requests from Ethereum repositories (EIPs, ERCs, RIPs) every 2 hours, generating chart-ready data for frontend visualization.

## 🎯 Overview

**Monitored Repositories:**
- `ethereum/EIPs` - Ethereum Improvement Proposals
- `ethereum/ERCs` - Ethereum Request for Comments 
- `ethereum/RIPs` - Rollup Improvement Proposals

**Core Features:**
- Automated PR fetching every 2 hours
- Label processing (raw GitHub + custom refinement)
- Monthly historical snapshots
- Chart collections for 3 analytical graphs
- MongoDB storage with optimized collections

## 📊 Chart Collections

The system generates **12 MongoDB collections** for 3 analytical graphs:

### Graph 1: PR State Counts
- **Created/Merged/Closed**: Monthly activity counts  
- **Total Open**: Cumulative open PRs (matches repo state)
- Collections: `eipsPRCharts`, `ercsPRCharts`, `ripsPRCharts`, `allPRCharts`

### Graph 2: Custom Labels  
- **EIP Update, New EIP, Status Change, Typo Fix, etc.**
- Collections: `eipsCustomCharts`, `ercsCustomCharts`, `ripsCustomCharts`, `allCustomCharts`

### Graph 3: Raw GitHub Labels
- **c-update, c-new, a-review, e-review, draft, final, etc.**
- Collections: `eipsRawCharts`, `ercsRawCharts`, `ripsRawCharts`, `allRawCharts`

## 📁 File Structure

```
PRsScheduler/
├── index.js                    # Main cron scheduler
├── fetch-github-prs.js         # PR fetching & processing
├── snapshot-open-prs.js        # Historical snapshots  
├── populate-chart-collections.js  # Generate chart collections
├── api-server.js               # REST API server
├── package.json                # Dependencies
├── .env                        # Environment variables
└── models/                     # Database schemas
    ├── EipPr.js
    ├── ErcPr.js
    └── RawLabelsPr.js
```

## ⚙️ Setup

### Environment Variables
```env
GITHUB_TOKEN=your_github_personal_access_token
OPENPRS_MONGODB_URI=mongodb://localhost:27017
OPENPRS_DATABASE=prsdb
```

### Installation
```bash
npm install
# Configure .env file with your credentials
```

## 🚀 Usage

### Start Automated Scheduler
```bash
npm start              # Runs every 2 hours automatically
```

### Manual Operations
```bash
npm run fetch          # Fetch PRs once
npm run snapshot       # Create snapshots once  
npm run populate-charts # Generate chart collections
npm run api            # Start API server
```