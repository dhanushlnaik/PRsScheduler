# Collections Information Guide

A comprehensive guide to all MongoDB collections in the PR Scheduler system, their data formats, and frontend usage patterns.

## 📊 Overview of Collections

The system maintains **12 primary collections** organized into **4 categories**:

### 1. **Core PR Collections** (3)
- `eipprs` - EIP Pull Requests with processed custom labels
- `ercprs` - ERC Pull Requests with processed custom labels  
- `ripprs` - RIP Pull Requests with processed custom labels

### 2. **Raw Labels Collections** (3)
- `eip_raw_labels` - EIP PRs with both raw GitHub labels and refined labels
- `erc_raw_labels` - ERC PRs with both raw GitHub labels and refined labels
- `rip_raw_labels` - RIP PRs with both raw GitHub labels and refined labels

### 3. **Historical Snapshots** (3)
- `open_pr_snapshots` - Monthly snapshots of open EIP PRs
- `open_erc_pr_snapshots` - Monthly snapshots of open ERC PRs
- `open_rip_pr_snapshots` - Monthly snapshots of open RIP PRs

### 4. **Chart Collections (API-Ready)** (4)
- `eipsPRCharts` - EIP chart data in API-ready format
- `ercsPRCharts` - ERC chart data in API-ready format
- `ripsPRCharts` - RIP chart data in API-ready format
- `allPRCharts` - Combined data from all specification types

---

## 🔍 Detailed Collection Formats

### 1. Core PR Collections (`eipprs`, `ercprs`, `ripprs`)

**Purpose**: Main PR data with processed custom labels for business logic

**Document Structure**:
```javascript
{
  _id: ObjectId("..."),
  prId: 1234567890,           // GitHub PR ID
  number: 8234,               // PR number
  title: "Update EIP-1559: Fix typo in specification",
  author: "vitalik",          // GitHub username
  prUrl: "https://github.com/ethereum/EIPs/pull/8234",
  githubLabels: [             // Raw GitHub labels
    "c-update",
    "typo-fix", 
    "e-review"
  ],
  state: "open",              // open|closed
  mergeable_state: "clean",   // GitHub mergeable state
  createdAt: ISODate("2024-01-15T10:30:00Z"),
  updatedAt: ISODate("2024-01-16T14:20:00Z"),
  closedAt: null,             // Date if closed/merged
  mergedAt: null,             // Date if merged
  specType: "EIP",            // EIP|ERC|RIP
  customLabels: [             // Processed business labels
    "EIP Update",
    "Typo Fix",
    "Editor Review"
  ]
}
```

**Frontend Usage**:
```javascript
// Get all open EIP PRs with specific labels
const openEIPs = await fetch('/api/prs/eips?state=open&label=Editor Review');

// Count PRs by custom labels
const labelStats = await fetch('/api/stats/eips/labels');

// Filter by author
const authorPRs = await fetch('/api/prs/eips?author=vitalik');
```

### 2. Raw Labels Collections (`eip_raw_labels`, `erc_raw_labels`, `rip_raw_labels`)

**Purpose**: GitHub labels analysis and refined label processing

**Document Structure**:
```javascript
{
  _id: ObjectId("..."),
  prId: 1234567890,
  number: 8234,
  title: "Update EIP-1559: Fix typo in specification", 
  author: "vitalik",
  prUrl: "https://github.com/ethereum/EIPs/pull/8234",
  rawGithubLabels: [          // Exact GitHub labels
    "c-update",
    "typo-fix",
    "e-review",
    "draft"
  ],
  refinedLabels: [            // Processed from raw labels
    "Update",
    "Typo Fix", 
    "Editor Review",
    "Draft"
  ],
  state: "open",
  mergeable_state: "clean",
  createdAt: ISODate("2024-01-15T10:30:00Z"),
  updatedAt: ISODate("2024-01-16T14:20:00Z"),
  closedAt: null,
  mergedAt: null,
  specType: "EIP"
}
```

**Frontend Usage**:
```javascript
// Compare raw vs refined labels
const labelComparison = await fetch('/api/labels/eips/comparison');

// Get all unique GitHub labels
const githubLabels = await fetch('/api/labels/eips/raw');

// Filter by refined labels
const draftPRs = await fetch('/api/prs/eips?refinedLabel=Draft');
```

### 3. Historical Snapshots (`open_pr_snapshots`, `open_erc_pr_snapshots`, `open_rip_pr_snapshots`)

**Purpose**: Monthly historical data of open PRs for trend analysis

**Document Structure**:
```javascript
{
  _id: ObjectId("..."),
  month: "2024-01",           // YYYY-MM format
  snapshotDate: "2024-01-31", // YYYY-MM-DD format
  prs: [                      // Array of PR objects
    {
      prId: 1234567890,
      number: 8234,
      title: "Update EIP-1559: Fix typo",
      githubLabels: ["c-update", "typo-fix"],
      state: "open",
      createdAt: ISODate("2024-01-15T10:30:00Z"),
      closedAt: null,
      customLabels: ["EIP Update", "Typo Fix"]
    },
    // ... more PRs
  ]
}
```

**Frontend Usage**:
### 4. Chart Collections (`eipsPRCharts`, `ercsPRCharts`, `ripsPRCharts`, `allPRCharts`)

**Purpose**: Pre-aggregated data optimized for frontend charts and graphs

**Document Structure**:
```javascript
{
  _id: "2024-01-created-1728123456789-0.123",
  category: "eips",           // eips|ercs|rips|all
  monthYear: "2024-01",       // YYYY-MM format
  type: "Created",            // Created|Merged|Closed|Open
  count: 45                   // Number (negative for Merged/Closed)
}
```

**Complete Month Example**:
```javascript
[
  {
    _id: "2024-01-created-...",
    category: "eips",
    monthYear: "2024-01", 
    type: "Created",
    count: 45
  },
  {
    _id: "2024-01-merged-...",
    category: "eips",
    monthYear: "2024-01",
    type: "Merged", 
    count: -12              // Negative value
  },
  {
    _id: "2024-01-closed-...",
    category: "eips",
    monthYear: "2024-01",
    type: "Closed",
    count: -8               // Negative value  
  },
  {
    _id: "2024-01-open-...",
    category: "eips", 
    monthYear: "2024-01",
    type: "Open",
    count: 25               // Remaining open
  }
]
```

**Frontend Usage**:
```javascript
// Get chart data for all EIPs
const eipChartData = await fetch('/api/charts/eips');

// Get combined data for all specs  
const allChartData = await fetch('/api/charts/all');

// Get specific month range
const rangeData = await fetch('/api/charts/eips?from=2024-01&to=2024-06');
```

---

## 🎯 Frontend Integration Patterns

### 1. **Graph 1: PR State Counts** 
Use `*PRCharts` collections for monthly PR lifecycle data.

```javascript
// React component example
const PRStateChart = () => {
  const [data, setData] = useState([]);
  
  useEffect(() => {
    fetch('/api/charts/eips')
      .then(res => res.json())
      .then(chartData => {
        // Transform for your chart library
        const transformed = chartData.map(item => ({
          month: item.monthYear,
          [item.type]: Math.abs(item.count), // Use absolute values
          raw: item.count // Keep raw for calculations
        }));
        setData(transformed);
      });
  }, []);
  
  return <BarChart data={data} />;
};
```

### 2. **Graph 2: Custom Labels Analysis**
Use core PR collections (`eipprs`, `ercprs`, `ripprs`) for custom label trends.

```javascript
// Vue.js component example
const CustomLabelsChart = {
  data() {
    return { labelData: [] };
  },
  async mounted() {
    const response = await fetch('/api/prs/eips/labels-by-month');
    this.labelData = await response.json();
  },
  template: `
    <div>
      <LineChart :data="labelData" />
    </div>
  `
};
```

### 3. **Graph 3: Raw GitHub Labels**
Use raw labels collections for GitHub label analysis.

```javascript
// Angular component example
@Component({
  selector: 'app-github-labels',
  template: '<canvas #chartCanvas></canvas>'
})
export class GitHubLabelsComponent {
  @ViewChild('chartCanvas') canvas: ElementRef;
  
  async ngOnInit() {
    const response = await fetch('/api/labels/eips/raw-by-month');
    const data = await response.json();
    
    // Render with Chart.js or similar
    this.renderChart(data);
  }
}
```

---

## 📋 Query Examples for Common Frontend Needs

### Get Latest PR Statistics
```javascript
// Get count of PRs by state
db.eipprs.aggregate([
  {
    $group: {
      _id: "$state",
      count: { $sum: 1 }
    }
  }
])

// Result:
[
  { _id: "open", count: 156 },
  { _id: "closed", count: 7668 }
]
```

### Get Monthly Trends
```javascript
// Get PR creation trend by month
db.eipprs.aggregate([
  {
    $group: {
      _id: {
        $dateToString: { 
          format: "%Y-%m", 
          date: "$createdAt" 
        }
      },
      count: { $sum: 1 }
    }
  },
  { $sort: { _id: -1 } }
])

// Result:
[
  { _id: "2024-10", count: 23 },
  { _id: "2024-09", count: 45 },
  { _id: "2024-08", count: 38 }
]
```

### Get Label Distribution
```javascript
// Get custom label distribution
db.eipprs.aggregate([
  { $unwind: "$customLabels" },
  {
    $group: {
      _id: "$customLabels",
      count: { $sum: 1 }
    }
  },
  { $sort: { count: -1 } }
])

// Result:
[
  { _id: "EIP Update", count: 2341 },
  { _id: "Editor Review", count: 892 },
  { _id: "Typo Fix", count: 445 }
]
```

### Get Author Statistics
```javascript
// Top contributing authors
db.eipprs.aggregate([
  {
    $group: {
      _id: "$author",
      prCount: { $sum: 1 },
      openPRs: {
        $sum: {
          $cond: [{ $eq: ["$state", "open"] }, 1, 0]
        }
      }
    }
  },
  { $sort: { prCount: -1 } },
  { $limit: 10 }
])
```

---

## 🔄 Real-time Data Updates

### WebSocket Integration
```javascript
// Example WebSocket listener for real-time updates
const ws = new WebSocket('ws://localhost:3001/ws');

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  
  switch(update.type) {
    case 'NEW_PR':
      // Update PR list
      updatePRList(update.data);
      break;
    case 'LABEL_CHANGE':
      // Update charts
      updateLabelCharts(update.data);
      break;
    case 'SNAPSHOT_COMPLETE':
      // Refresh historical data
      refreshTrends();
      break;
  }
};
```

### Polling for Updates
```javascript
// Poll for latest changes every 30 seconds
setInterval(async () => {
  const response = await fetch('/api/last-update');
  const lastUpdate = await response.json();
  
  if (lastUpdate.timestamp > this.lastKnownUpdate) {
    // Refresh data
    this.refreshData();
    this.lastKnownUpdate = lastUpdate.timestamp;
  }
}, 30000);
```

---

## 🎨 Frontend Framework Examples

### React with TypeScript
```typescript
interface PRData {
  prId: number;
  number: number;
  title: string;
  author: string;
  state: 'open' | 'closed';
  customLabels: string[];
  createdAt: string;
}

const usePRData = (specType: 'EIP' | 'ERC' | 'RIP') => {
  const [prs, setPRs] = useState<PRData[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetch(`/api/prs/${specType.toLowerCase()}s`)
      .then(res => res.json())
      .then(data => {
        setPRs(data);
        setLoading(false);
      });
  }, [specType]);
  
  return { prs, loading };
};
```

### Vue 3 Composition API
```vue
<template>
  <div>
    <ChartComponent :data="chartData" />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';

const chartData = ref([]);
const loading = ref(true);

const fetchChartData = async () => {
  try {
    const response = await fetch('/api/charts/eips');
    chartData.value = await response.json();
  } catch (error) {
    console.error('Failed to fetch chart data:', error);
  } finally {
    loading.value = false;
  }
};

const transformedData = computed(() => {
  return chartData.value.map(item => ({
    month: item.monthYear,
    type: item.type,
    value: Math.abs(item.count)
  }));
});

onMounted(fetchChartData);
</script>
```

### Svelte
```svelte
<script>
  import { onMount } from 'svelte';
  
  let prData = [];
  let selectedLabels = [];
  
  $: filteredPRs = prData.filter(pr => 
    selectedLabels.length === 0 || 
    pr.customLabels.some(label => selectedLabels.includes(label))
  );
  
  onMount(async () => {
    const response = await fetch('/api/prs/eips');
    prData = await response.json();
  });
</script>

<div>
  <LabelFilter bind:selected={selectedLabels} />
  <PRList data={filteredPRs} />
</div>
```

---

## 📈 Performance Optimization Tips

### Database Indexes
```javascript
// Recommended indexes for better query performance
db.eipprs.createIndex({ "state": 1, "updatedAt": -1 });
db.eipprs.createIndex({ "customLabels": 1 });
db.eipprs.createIndex({ "author": 1 });
db.eipprs.createIndex({ "createdAt": -1 });

// For chart collections
db.eipsPRCharts.createIndex({ "monthYear": -1, "type": 1 });
db.eipsPRCharts.createIndex({ "category": 1, "monthYear": -1 });
```

### Pagination
```javascript
// Implement pagination for large datasets
const getPaginatedPRs = async (page = 1, limit = 50) => {
  const skip = (page - 1) * limit;
  
  const [prs, total] = await Promise.all([
    fetch(`/api/prs/eips?skip=${skip}&limit=${limit}`),
    fetch('/api/prs/eips/count')
  ]);
  
  return {
    data: await prs.json(),
    pagination: {
      page,
      limit,
      total: await total.json(),
      hasNext: skip + limit < await total.json()
    }
  };
};
```

### Caching Strategy
```javascript
// Cache frequently accessed data
const cache = new Map();

const getCachedData = async (key, fetcher, ttl = 300000) => { // 5 min TTL
  if (cache.has(key)) {
    const { data, timestamp } = cache.get(key);
    if (Date.now() - timestamp < ttl) {
      return data;
    }
  }
  
  const data = await fetcher();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
};
```

---

*This guide provides a complete reference for integrating the PR Scheduler data into any frontend application. Use the appropriate collection based on your specific data needs and performance requirements.*