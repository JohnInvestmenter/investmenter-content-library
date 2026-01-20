# AI Search Integration Guide

## How It Works

### Current Architecture (Before AI):
```
User types "Immobilien" → Simple search → Filters content → Shows results
```

### New Architecture (With AI):
```
User types "Immobilien"
  ↓
Ollama AI running on localhost:11434
  ↓
AI returns: {
  translatedQuery: "real estate",
  searchTerms: ["immobilien", "real estate", "property", "investment", ...]
}
  ↓
Search uses ALL terms → Better results → Bilingual search!
```

**KEY POINT:** AI never touches Notion. It only enhances your search keywords.

---

## Step 1: Add the AI Search Script to index.html

Find the closing `</body>` tag in index.html and add this BEFORE it:

```html
<!-- AI Search Integration -->
<script src="ai-search.js"></script>
<script>
  // Global AI status
  let aiSearchEnabled = false;
  let aiSearchPending = false;

  // Initialize AI search on page load
  (async function() {
    aiSearchEnabled = await initAISearch();

    if (aiSearchEnabled) {
      showToast('AI Search Ready', 'Multilingual search powered by Llama AI', 'success');
    }
  })();
</script>
```

---

## Step 2: Replace the renderWA() Function

Find the `renderWA()` function (around line 2078) and replace the filter logic:

**BEFORE (Current Code - Lines 2080-2085):**
```javascript
const search = (waSearchInput.value||'').toLowerCase();

const filtered = waContents.filter(c =>
  (!search || (c.title||'').toLowerCase().includes(search) || (c.content||'').toLowerCase().includes(search) || (c.tags||[]).some(t=> (t||'').toLowerCase().includes(search))) &&
  (activeWAFolder==='all' || ((c.folder || '').trim() || UNASSIGNED_FOLDER) === activeWAFolder)
);
```

**AFTER (With AI Enhancement):**
```javascript
const search = (waSearchInput.value||'').toLowerCase();

// Use AI-enhanced search if available
let filtered = waContents;

if (search && aiSearchEnabled && !aiSearchPending) {
  // Show loading indicator
  aiSearchPending = true;

  // Use AI to enhance search
  aiEnhancedSearch(search, waContents).then(result => {
    aiSearchPending = false;

    if (result && result.results) {
      // Filter by folder
      filtered = result.results.filter(c =>
        (activeWAFolder==='all' || ((c.folder || '').trim() || UNASSIGNED_FOLDER) === activeWAFolder)
      );

      // Show AI insights
      if (result.enhancement) {
        console.log('🤖 AI detected language:', result.enhancement.detectedLanguage);
        console.log('🔍 Search terms used:', result.searchTermsUsed);
      }

      // Re-render with AI results
      renderWAResults(filtered);
    }
  }).catch(err => {
    aiSearchPending = false;
    console.warn('AI search failed, using basic search:', err);
    // Fallback to basic search
    filtered = basicFilterWA(search, waContents, activeWAFolder);
    renderWAResults(filtered);
  });

  return; // Exit early, results will render after AI completes

} else {
  // Use basic search (fallback or when AI disabled)
  filtered = basicFilterWA(search, waContents, activeWAFolder);
}

renderWAResults(filtered);
```

---

## Step 3: Add Helper Functions

Add these helper functions AFTER the renderWA() function:

```javascript
/**
 * Basic filter (fallback when AI not available)
 */
function basicFilterWA(search, contents, folder) {
  return contents.filter(c =>
    (!search ||
      (c.title||'').toLowerCase().includes(search) ||
      (c.content||'').toLowerCase().includes(search) ||
      (c.tags||[]).some(t=> (t||'').toLowerCase().includes(search))
    ) &&
    (folder==='all' || ((c.folder || '').trim() || UNASSIGNED_FOLDER) === folder)
  );
}

/**
 * Render results (extracted from renderWA for reuse)
 */
function renderWAResults(filtered) {
  const grid = document.getElementById('wa-contentGrid');
  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if(waPage>pageCount) waPage = pageCount;

  const start = (waPage-1)*pageSize;
  const slice = filtered.slice(start,start+pageSize);

  if(!slice.length){
    showEmptyState('wa-contentGrid', 'inbox', 'No Content Found',
      search ? 'Try adjusting your search or filters' : 'Start by adding your first WhatsApp content',
      !search ? 'Add Content' : '',
      'document.getElementById("wa-addBtn").click()');
    return;
  }

  // ... rest of the rendering code (keep existing card HTML generation)
}
```

---

## Step 4: Add AI Status Indicator (Optional but Recommended)

Add this HTML after the search input in index.html (around line 285):

```html
<div id="wa-searchInput" ...></div>

<!-- AI Status Indicator -->
<div id="ai-status" class="text-xs text-[var(--muted-ink)] mt-1 flex items-center gap-1">
  <span id="ai-status-icon"></span>
  <span id="ai-status-text">Checking AI...</span>
</div>
```

Add this JavaScript to update the indicator:

```javascript
function updateAIStatus(enabled) {
  const icon = document.getElementById('ai-status-icon');
  const text = document.getElementById('ai-status-text');

  if (enabled) {
    icon.innerHTML = '<i data-lucide="zap" style="width:14px;height:14px;color:#10b981;"></i>';
    text.textContent = 'AI Search Active (German/English)';
  } else {
    icon.innerHTML = '<i data-lucide="search" style="width:14px;height:14px;"></i>';
    text.textContent = 'Basic Search (Ollama not running)';
  }

  lucide.createIcons();
}

// Call after AI init
initAISearch().then(enabled => {
  aiSearchEnabled = enabled;
  updateAIStatus(enabled);
});
```

---

## Step 5: Add Debouncing for Better Performance

To avoid hitting the AI on every keystroke, add debouncing:

```javascript
let searchDebounceTimer;

waSearchInput.addEventListener('input', () => {
  waSearchClear.classList.toggle('hidden', !waSearchInput.value);

  // Clear previous timer
  clearTimeout(searchDebounceTimer);

  // Wait 500ms after user stops typing
  searchDebounceTimer = setTimeout(() => {
    waPage = 1;
    renderWA();
  }, 500); // 500ms delay
});
```

---

## Testing Checklist

### 1. Test AI Status
```bash
# Make sure Ollama is running
ollama serve

# In browser console:
checkOllamaStatus()  // Should return true
```

### 2. Test Basic Search (German)
- Type: "Immobilien"
- Should find content with "real estate", "property", "investment"

### 3. Test Translation
- Type: "real estate"
- Should also find German content "Immobilien"

### 4. Test Fallback
```bash
# Stop Ollama
# Search should still work with basic keyword matching
```

### 5. Check Console Logs
```
✅ AI Search enabled (Ollama running)
🤖 AI detected language: de
🔍 Search terms used: ["immobilien", "real estate", "property", ...]
```

---

## Performance Expectations

| Query | AI Response Time | Total Search Time |
|-------|------------------|-------------------|
| "Immobilien" | 3-8 seconds | 3-8 seconds |
| "real estate" | 3-8 seconds | 3-8 seconds |
| "invest" | 2-5 seconds | 2-5 seconds |

**Note:** First query may be slower (model loading). Subsequent queries are faster.

---

## Troubleshooting

### AI Search Not Working
1. Check Ollama is running: `curl http://localhost:11434`
2. Check console for errors
3. Verify ai-search.js is loaded
4. Try basic search as fallback

### Slow Performance
1. Use smaller model: `ollama pull llama3.2:3b`
2. Increase debounce delay to 800ms
3. Close other applications

### CORS Errors
- Ollama runs on localhost:11434
- Your app must also be on localhost or 127.0.0.1
- If deployed, set up proxy

---

## Next Steps

After basic integration works, you can add:

1. **Search Suggestions Dropdown**
   - Show AI-generated search terms as user types
   - Click to apply suggested term

2. **Language Toggle**
   - Button to force translation direction
   - "DE→EN" or "EN→DE"

3. **Semantic Search (Advanced)**
   - Add embeddings for true semantic search
   - See `SEMANTIC_SEARCH_GUIDE.md` (coming soon)

---

## Comparison: Before vs After

### Before (Basic Search):
```
User: "Immobilien"
→ Searches: "immobilien" (exact match only)
→ Finds: Only content with German word
```

### After (AI Search):
```
User: "Immobilien"
→ AI translates to: "real estate"
→ AI expands: ["immobilien", "real estate", "property", "investment", "housing"]
→ Searches ALL terms
→ Finds: German AND English content! 🎉
```

---

## Cost Analysis

**Cloud API (e.g., OpenAI GPT-4):**
- Cost: $0.01-0.03 per search
- 1000 searches/day = $10-30/day = $300-900/month

**Self-Hosted Ollama:**
- Cost: $0 (electricity only ~$5/month)
- Unlimited searches
- **Savings: $3,600-10,800/year!**

---

## Support

If you encounter issues:
1. Check Ollama logs: `ollama logs`
2. Test model directly: `ollama run llama3.1:8b`
3. Verify model is downloaded: `ollama list`
4. Check RAM usage: Task Manager → Performance
