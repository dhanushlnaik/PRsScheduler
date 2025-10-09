# PR Scheduler API Reference

This document provides comprehensive API documentation for the PR Scheduler system, which tracks and analyzes Pull Requests from Ethereum Improvement Proposals (EIPs), Ethereum Request for Comments (ERCs), and Rollup Improvement Proposals (RIPs).

## Table of Contents

- [Overview](#overview)
- [Base URL](#base-url)
- [Authentication](#authentication)
- [Data Models](#data-models)
- [Graph APIs](#graph-apis)
  - [Graph 1: PR State Counts](#graph-1-pr-state-counts)
  - [Graph 2: Custom Labels](#graph-2-custom-labels)
  - [Graph 3: Raw GitHub Labels](#graph-3-raw-github-labels)
- [Utility Endpoints](#utility-endpoints)
- [Error Handling](#error-handling)
- [Examples](#examples)

## Overview

The PR Scheduler API provides three main graph endpoints that serve different analytical views of PR data:

1. **Graph 1**: Continuous data showing open, closed, merged, and created PRs by month-year
2. **Graph 2**: Custom processed labels (EIP Update, New EIP, Status Change, Misc, etc.) by month-year
3. **Graph 3**: Raw GitHub labels by month-year

All endpoints support filtering by specification type (EIP, ERC, RIP) and optional date ranges.

## Base URL

```
http://localhost:3001/api
```

## Authentication

Currently, no authentication is required. All endpoints are publicly accessible.

## Data Models

### PR State Counts (Graph 1)
```json
[
  {
    "_id": "68e6524276256fa65caeeca0",
    "category": "eips",
    "monthYear": "2024-09",
    "type": "Created",
    "count": 55
  },
  {
    "_id": "68e6524276256fa65caeeca1", 
    "category": "eips",
    "monthYear": "2024-09",
    "type": "Merged",
    "count": -38
  },
  {
    "_id": "68e6524276256fa65caeeca2",
    "category": "eips", 
    "monthYear": "2024-09",
    "type": "Closed",
    "count": -20
  },
  {
    "_id": "68e6524276256fa65caeeca3",
    "category": "eips",
    "monthYear": "2024-09", 
    "type": "Open",
    "count": 107
  }
]
```

### Custom Labels (Graph 2)
```json
{
  "monthYear": "2024-01",
  "labels": {
    "EIP Update": 5,
    "New EIP": 3,
    "Status Change": 2,
    "Typo Fix": 1,
    "Misc": 4
  }
}
```

### Raw GitHub Labels (Graph 3)
```json
{
  "monthYear": "2024-01",
  "labels": {
    "c-update": 8,
    "c-new": 3,
    "a-review": 5,
    "e-review": 2,
    "draft": 4
  }
}
```

## Graph APIs

### Graph 1: PR State Counts

Shows continuous data of PR states (created, closed, merged, open) aggregated by month-year.

#### Endpoint
```
GET /api/graph1/{specType}
```

#### Parameters
- `specType` (path, required): Specification type
  - `EIP` - Ethereum Improvement Proposals
  - `ERC` - Ethereum Request for Comments  
  - `RIP` - Rollup Improvement Proposals

#### Query Parameters
- `startDate` (optional): Start date filter (ISO 8601 format: YYYY-MM-DD)
- `endDate` (optional): End date filter (ISO 8601 format: YYYY-MM-DD)

#### Response
```json
{
  "specType": "EIP",
  "data": [
    {
      "_id": "68e6524276256fa65caeeca0",
      "category": "eips",
      "monthYear": "2024-09",
      "type": "Created",
      "count": 55
    },
    {
      "_id": "68e6524276256fa65caeeca1",
      "category": "eips",
      "monthYear": "2024-09",
      "type": "Merged", 
      "count": -38
    },
    {
      "_id": "68e6524276256fa65caeeca2",
      "category": "eips",
      "monthYear": "2024-09",
      "type": "Closed",
      "count": -20
    },
    {
      "_id": "68e6524276256fa65caeeca3",
      "category": "eips",
      "monthYear": "2024-09",
      "type": "Open",
      "count": 107
    }
  ],
  "totalPRs": 1500,
  "dateRange": {
    "start": "2023-01-01",
    "end": "2024-12-31"
  }
}
```

#### Example Usage
```bash
# Get all EIP data
curl "http://localhost:3001/api/graph1/EIP"

# Get ERC data for specific date range
curl "http://localhost:3001/api/graph1/ERC?startDate=2024-01-01&endDate=2024-06-30"

# Get RIP data
curl "http://localhost:3001/api/graph1/RIP"
```

### Graph 2: Custom Labels

Shows custom processed labels aggregated by month-year. These labels are derived from PR titles and GitHub labels using intelligent categorization logic.

#### Endpoint
```
GET /api/graph2/{specType}
```

#### Parameters
- `specType` (path, required): Specification type (EIP, ERC, RIP)

#### Query Parameters
- `startDate` (optional): Start date filter (ISO 8601 format: YYYY-MM-DD)
- `endDate` (optional): End date filter (ISO 8601 format: YYYY-MM-DD)

#### Custom Label Categories

**EIP Labels:**
- `EIP Update` - Updates to existing EIPs
- `New EIP` - New EIP proposals
- `Status Change` - EIP status changes
- `Typo Fix` - Typo and grammar fixes
- `Created By Bot` - Bot-generated PRs
- `Author Review` - PRs under author review
- `Editor Review` - PRs under editor review
- `Draft` - Draft status EIPs
- `Final` - Final status EIPs
- `Misc` - Miscellaneous changes

**ERC Labels:**
- `ERC Update` - Updates to existing ERCs
- `New ERC` - New ERC proposals
- `Status Change` - ERC status changes
- `Typo Fix` - Typo and grammar fixes
- `Created By Bot` - Bot-generated PRs
- `Misc` - Miscellaneous changes

**RIP Labels:**
- `Update` - Updates to existing RIPs
- `New RIP` - New RIP proposals
- `Typo Fix` - Typo and grammar fixes
- `Misc` - Miscellaneous changes

#### Response
```json
{
  "specType": "EIP",
  "data": [
    {
      "monthYear": "2024-01",
      "labels": {
        "EIP Update": 8,
        "New EIP": 3,
        "Status Change": 2,
        "Typo Fix": 1,
        "Author Review": 5,
        "Editor Review": 2,
        "Draft": 4,
        "Misc": 3
      }
    }
  ],
  "totalPRs": 1500,
  "dateRange": {
    "start": "earliest",
    "end": "latest"
  }
}
```

#### Example Usage
```bash
# Get custom labels for EIPs
curl "http://localhost:3001/api/graph2/EIP"

# Get custom labels for ERCs with date filter
curl "http://localhost:3001/api/graph2/ERC?startDate=2024-01-01"

# Get custom labels for RIPs
curl "http://localhost:3001/api/graph2/RIP"
```

### Graph 3: Raw GitHub Labels

Shows raw GitHub labels as they appear in the repositories, aggregated by month-year.

#### Endpoint
```
GET /api/graph3/{specType}
```

#### Parameters
- `specType` (path, required): Specification type (EIP, ERC, RIP)

#### Query Parameters
- `startDate` (optional): Start date filter (ISO 8601 format: YYYY-MM-DD)
- `endDate` (optional): End date filter (ISO 8601 format: YYYY-MM-DD)

#### Common Raw Labels

**Status Labels:**
- `draft` - Draft status
- `review` - Under review
- `last-call` - Last call period
- `final` - Final status
- `stagnant` - Stagnant status
- `withdrawn` - Withdrawn status

**Category Labels:**
- `c-new` - New proposal
- `c-update` - Update to existing
- `c-status` - Status change

**Review Labels:**
- `a-review` - Author review
- `e-review` - Editor review
- `discuss` - Discussion needed
- `on-hold` - On hold
- `final-call` - Final call

**Type Labels:**
- `core` - Core EIP
- `networking` - Networking EIP
- `interface` - Interface EIP
- `erc` - ERC related
- `meta` - Meta EIP
- `informational` - Informational EIP

#### Response
```json
{
  "specType": "EIP",
  "data": [
    {
      "monthYear": "2024-01",
      "labels": {
        "c-update": 8,
        "c-new": 3,
        "a-review": 5,
        "e-review": 2,
        "draft": 4,
        "final": 1,
        "discuss": 2
      }
    }
  ],
  "totalPRs": 1500,
  "dateRange": {
    "start": "earliest",
    "end": "latest"
  }
}
```

#### Example Usage
```bash
# Get raw GitHub labels for EIPs
curl "http://localhost:3001/api/graph3/EIP"

# Get raw labels for ERCs with date range
curl "http://localhost:3001/api/graph3/ERC?startDate=2024-01-01&endDate=2024-03-31"

# Get raw labels for RIPs
curl "http://localhost:3001/api/graph3/RIP"
```

## Utility Endpoints

### Get Available Spec Types
```
GET /api/spec-types
```

Returns available specification types.

#### Response
```json
{
  "specTypes": ["EIP", "ERC", "RIP"],
  "description": "Available specification types for all endpoints"
}
```

### Get Data Summary
```
GET /api/summary
```

Returns summary statistics for all specification types.

#### Response
```json
{
  "EIP": {
    "totalPRs": 1500,
    "totalRawLabels": 1500,
    "dateRange": {
      "earliest": "2020-01-15T10:30:00.000Z",
      "latest": "2024-12-01T15:45:00.000Z"
    }
  },
  "ERC": {
    "totalPRs": 800,
    "totalRawLabels": 800,
    "dateRange": {
      "earliest": "2021-03-20T08:15:00.000Z",
      "latest": "2024-11-30T12:20:00.000Z"
    }
  },
  "RIP": {
    "totalPRs": 200,
    "totalRawLabels": 200,
    "dateRange": {
      "earliest": "2022-06-10T14:00:00.000Z",
      "latest": "2024-12-01T09:30:00.000Z"
    }
  }
}
```

### Health Check
```
GET /api/health
```

Returns API health status and MongoDB connection status.

#### Response
```json
{
  "status": "healthy",
  "timestamp": "2024-12-01T10:30:00.000Z",
  "mongodb": "connected"
}
```

## Error Handling

The API uses standard HTTP status codes and returns error information in JSON format.

### Error Response Format
```json
{
  "error": "Error type",
  "details": "Detailed error message",
  "timestamp": "2024-12-01T10:30:00.000Z"
}
```

### Common Error Codes

- `400 Bad Request` - Invalid parameters or spec type
- `404 Not Found` - Endpoint not found
- `500 Internal Server Error` - Server or database error

### Example Error Responses

#### Invalid Spec Type
```json
{
  "error": "Invalid spec type. Use EIP, ERC, or RIP"
}
```

#### Endpoint Not Found
```json
{
  "error": "Endpoint not found",
  "availableEndpoints": [
    "GET /api/graph1/:specType - PR state counts by month-year",
    "GET /api/graph2/:specType - Custom labels by month-year",
    "GET /api/graph3/:specType - Raw GitHub labels by month-year",
    "GET /api/spec-types - Available spec types",
    "GET /api/summary - Data summary for all spec types",
    "GET /api/health - Health check"
  ]
}
```

#### Server Error
```json
{
  "error": "Internal server error",
  "details": "MongoDB connection failed"
}
```

## Examples

### Complete Workflow Example

1. **Check API health:**
```bash
curl "http://localhost:3001/api/health"
```

2. **Get available spec types:**
```bash
curl "http://localhost:3001/api/spec-types"
```

3. **Get data summary:**
```bash
curl "http://localhost:3001/api/summary"
```

4. **Get PR state counts for EIPs:**
```bash
curl "http://localhost:3001/api/graph1/EIP"
```

5. **Get custom labels for ERCs with date filter:**
```bash
curl "http://localhost:3001/api/graph2/ERC?startDate=2024-01-01&endDate=2024-06-30"
```

6. **Get raw GitHub labels for RIPs:**
```bash
curl "http://localhost:3001/api/graph3/RIP"
```

### JavaScript/Node.js Example

```javascript
const fetch = require('node-fetch');

async function fetchGraphData() {
  const baseUrl = 'http://localhost:3001/api';
  
  try {
    // Get health status
    const health = await fetch(`${baseUrl}/health`);
    console.log('API Status:', await health.json());
    
    // Get EIP data for all three graphs
    const [graph1, graph2, graph3] = await Promise.all([
      fetch(`${baseUrl}/graph1/EIP`),
      fetch(`${baseUrl}/graph2/EIP`),
      fetch(`${baseUrl}/graph3/EIP`)
    ]);
    
    const prStates = await graph1.json();
    const customLabels = await graph2.json();
    const rawLabels = await graph3.json();
    
    console.log('PR States:', prStates.data);
    console.log('Custom Labels:', customLabels.data);
    console.log('Raw Labels:', rawLabels.data);
    
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

fetchGraphData();
```

### Python Example

```python
import requests
import json

def fetch_graph_data():
    base_url = 'http://localhost:3001/api'
    
    try:
        # Get health status
        health_response = requests.get(f'{base_url}/health')
        print('API Status:', health_response.json())
        
        # Get EIP data for all three graphs
        graph1_response = requests.get(f'{base_url}/graph1/EIP')
        graph2_response = requests.get(f'{base_url}/graph2/EIP')
        graph3_response = requests.get(f'{base_url}/graph3/EIP')
        
        pr_states = graph1_response.json()
        custom_labels = graph2_response.json()
        raw_labels = graph3_response.json()
        
        print('PR States:', json.dumps(pr_states['data'], indent=2))
        print('Custom Labels:', json.dumps(custom_labels['data'], indent=2))
        print('Raw Labels:', json.dumps(raw_labels['data'], indent=2))
        
    except Exception as error:
        print('Error fetching data:', error)

if __name__ == '__main__':
    fetch_graph_data()
```

## Rate Limiting

Currently, no rate limiting is implemented. However, it's recommended to:

- Make reasonable requests (avoid excessive polling)
- Cache responses when appropriate
- Use date range filters to limit data size

## Data Freshness

Data is updated every 2 hours via the scheduler:

- **00:00, 02:00, 04:00, etc.** - Fresh PR data fetched from GitHub
- **00:30, 02:30, 04:30, etc.** - Snapshots and analytics updated

The API serves the most recent data available in the database.

## Support

For issues, questions, or feature requests, please refer to the project documentation or contact the development team.

## Chart Collections Integration

The system also creates dedicated chart collections that match your existing Next.js API structure:

### Chart Collections Created
- **`eipsPRCharts`** - EIP chart data in the specific format
- **`ercsPRCharts`** - ERC chart data in the specific format  
- **`ripsPRCharts`** - RIP chart data in the specific format
- **`allPRCharts`** - Combined data from all spec types

### Populate Chart Collections
```bash
# Generate chart collections in the required format
npm run populate-charts
```

This will create the collections that your existing Next.js API can query directly.

### Next.js API Integration

Your existing Next.js API structure will work with these collections:

```javascript
// pages/api/charts/[name].js
import { MongoClient } from 'mongodb';

const COLLECTIONS = {
  eips: "eipsPRCharts",
  ercs: "ercsPRCharts", 
  rips: "ripsPRCharts",
  all: "allPRCharts",
};

export default async function handler(req, res) {
  const { name } = req.query;
  const collectionName = COLLECTIONS[name];
  const collection = db.collection(collectionName);
  
  // Convert cursor to an array - this will return data in the exact format you showed
  const data = await collection.find({}).toArray();
  return res.status(200).json(data);
}
```

### Data Format Notes

- **Merged** and **Closed** counts are negative values (as shown in your example)
- **Open** count is calculated as: `Created - Merged - Closed`
- Each type (Created, Merged, Closed, Open) is a separate document
- Data is sorted by monthYear (descending) then by type
- Each document has a unique `_id` for MongoDB compatibility

---

*Last updated: December 2024*
