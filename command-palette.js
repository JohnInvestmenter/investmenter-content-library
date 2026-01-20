/**
 * Command Palette - Notion-style AI-powered search
 * 
 * Features:
 * - Cmd+K / Ctrl+K keyboard shortcut
 * - AI-powered bilingual search (German/English)
 * - Quick actions
 * - Recent searches
 * - Keyboard navigation
 */

class CommandPalette {
  constructor(options = {}) {
    this.getWAContents = options.getWAContents || (() => []);
    this.getGPTPrompts = options.getGPTPrompts || (() => []);
    this.onOpenContent = options.onOpenContent || (() => { });
    this.onAddContent = options.onAddContent || (() => { });
    this.onToggleTheme = options.onToggleTheme || (() => { });

    this.isOpen = false;
    this.selectedIndex = 0;
    this.currentItems = [];
    this.searchTimeout = null;
    this.aiAvailable = false;
    this.isSearching = false;

    this.recentSearches = this.loadRecentSearches();

    this.init();
  }

  async init() {
    // Check if AI (Ollama) is available
    this.aiAvailable = await this.checkAIStatus();

    // Create DOM elements
    this.createPalette();

    // Bind keyboard shortcuts
    this.bindGlobalShortcuts();

    console.log(`🎨 Command Palette initialized (AI: ${this.aiAvailable ? 'enabled' : 'disabled'})`);
  }

  async checkAIStatus() {
    if (typeof checkOllamaStatus === 'function') {
      return await checkOllamaStatus();
    }
    try {
      const response = await fetch('http://localhost:11434', {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  createPalette() {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'commandPalette';
    overlay.className = 'command-palette-overlay';

    overlay.innerHTML = `
      <div class="command-palette-modal">
        <!-- Search Header -->
        <div class="command-palette-search">
          <i data-lucide="search" class="command-palette-search-icon"></i>
          <input 
            type="text" 
            class="command-palette-input" 
            id="cpInput"
            placeholder="Search content, actions, or type a command..."
            autocomplete="off"
            spellcheck="false"
          >
          <div class="command-palette-status">
            <span class="command-palette-ai-badge ${this.aiAvailable ? '' : 'inactive'}" id="cpAIBadge">
              <i data-lucide="sparkles"></i>
              <span>AI</span>
            </span>
          </div>
          <kbd class="command-palette-kbd">esc</kbd>
        </div>
        
        <!-- Scrollable Content -->
        <div class="command-palette-content" id="cpContent">
          <!-- Quick Actions Section -->
          <div class="command-palette-section" id="cpQuickActionsSection">
            <div class="command-palette-section-title">Quick Actions</div>
            <div class="command-palette-items" id="cpQuickActions"></div>
          </div>
          
          <!-- Recent Searches Section -->
          <div class="command-palette-section ${this.recentSearches.length === 0 ? 'hidden' : ''}" id="cpRecentSection">
            <div class="command-palette-section-title">Recent Searches</div>
            <div class="command-palette-items" id="cpRecentItems"></div>
          </div>
          
          <!-- Search Results Section -->
          <div class="command-palette-section hidden" id="cpResultsSection">
            <div class="command-palette-section-title" id="cpResultsTitle">Results</div>
            <div class="command-palette-items" id="cpResultItems"></div>
          </div>
          
          <!-- Loading State -->
          <div class="command-palette-loading hidden" id="cpLoading">
            <div class="command-palette-spinner"></div>
            <span>Searching with AI...</span>
          </div>
          
          <!-- Empty State -->
          <div class="command-palette-empty hidden" id="cpEmpty">
            <i data-lucide="search-x" class="command-palette-empty-icon"></i>
            <div class="command-palette-empty-title">No results found</div>
            <div class="command-palette-empty-text">Try a different search term</div>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="command-palette-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
          <span><kbd>↵</kbd> Select</span>
          <span><kbd>esc</kbd> Close</span>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Get references
    this.overlay = overlay;
    this.modal = overlay.querySelector('.command-palette-modal');
    this.input = document.getElementById('cpInput');
    this.quickActionsContainer = document.getElementById('cpQuickActions');
    this.recentContainer = document.getElementById('cpRecentItems');
    this.resultsContainer = document.getElementById('cpResultItems');
    this.recentSection = document.getElementById('cpRecentSection');
    this.resultsSection = document.getElementById('cpResultsSection');
    this.resultsTitle = document.getElementById('cpResultsTitle');
    this.loadingEl = document.getElementById('cpLoading');
    this.emptyEl = document.getElementById('cpEmpty');
    this.aiBadge = document.getElementById('cpAIBadge');

    // Render quick actions
    this.renderQuickActions();
    this.renderRecentSearches();

    // Bind events
    this.bindEvents();

    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  getQuickActions() {
    return [
      {
        id: 'search',
        action: 'search',
        icon: 'search',
        title: 'Search Content',
        subtitle: 'Find WhatsApp messages and GPT prompts',
        shortcut: null
      },
      {
        id: 'translate',
        action: 'translate',
        icon: 'languages',
        title: 'Translate Text',
        subtitle: 'German ↔ English translation',
        shortcut: null
      },
      {
        id: 'summarize',
        action: 'summarize',
        icon: 'file-text',
        title: 'Summarize Content',
        subtitle: 'Get AI-powered summaries',
        shortcut: null
      },
      {
        id: 'add-whatsapp',
        action: 'add-whatsapp',
        icon: 'message-circle-plus',
        title: 'Add WhatsApp Content',
        subtitle: 'Create new WhatsApp message',
        shortcut: null
      },
      {
        id: 'add-prompt',
        action: 'add-prompt',
        icon: 'cpu',
        title: 'Add GPT Prompt',
        subtitle: 'Create new GPT prompt template',
        shortcut: null
      },
      {
        id: 'toggle-theme',
        action: 'toggle-theme',
        icon: 'moon',
        title: 'Toggle Dark Mode',
        subtitle: 'Switch between light and dark theme',
        shortcut: null
      }
    ];
  }

  renderQuickActions() {
    const actions = this.getQuickActions();
    this.quickActionsContainer.innerHTML = actions.map(action => this.renderItem(action, 'action')).join('');
    this.updateCurrentItems();
  }

  renderRecentSearches() {
    if (this.recentSearches.length === 0) {
      this.recentSection.classList.add('hidden');
      return;
    }

    this.recentSection.classList.remove('hidden');
    this.recentContainer.innerHTML = this.recentSearches.map((query, index) => `
      <button class="command-palette-item" data-type="recent" data-query="${this.escapeHtml(query)}">
        <div class="command-palette-item-icon">
          <i data-lucide="clock"></i>
        </div>
        <div class="command-palette-item-content">
          <div class="command-palette-item-title">${this.escapeHtml(query)}</div>
        </div>
      </button>
    `).join('');

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  renderItem(item, type) {
    if (type === 'action') {
      return `
        <button class="command-palette-item" data-type="action" data-action="${item.action}">
          <div class="command-palette-item-icon">
            <i data-lucide="${item.icon}"></i>
          </div>
          <div class="command-palette-item-content">
            <div class="command-palette-item-title">${item.title}</div>
            <div class="command-palette-item-subtitle">${item.subtitle}</div>
          </div>
          ${item.shortcut ? `
            <div class="command-palette-item-shortcut">
              <kbd class="command-palette-kbd">${item.shortcut}</kbd>
            </div>
          ` : ''}
        </button>
      `;
    }

    if (type === 'content') {
      const isWhatsApp = item.type === 'whatsapp';
      const preview = (item.content || item.prompt || '').substring(0, 60) + '...';
      return `
        <button class="command-palette-item" data-type="content" data-content-type="${item.type}" data-id="${item.id}">
          <div class="command-palette-item-icon">
            <i data-lucide="${isWhatsApp ? 'message-circle' : 'cpu'}"></i>
          </div>
          <div class="command-palette-item-content">
            <div class="command-palette-item-title">${this.escapeHtml(item.title)}</div>
            <div class="command-palette-item-subtitle">${this.escapeHtml(preview)}</div>
          </div>
          <span class="command-palette-item-badge ${isWhatsApp ? 'whatsapp' : 'prompt'}">
            ${isWhatsApp ? 'WhatsApp' : 'Prompt'}
          </span>
        </button>
      `;
    }

    return '';
  }

  bindGlobalShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Cmd+K or Ctrl+K to open
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        this.toggle();
      }

      // Escape to close (when open)
      if (e.key === 'Escape' && this.isOpen) {
        e.preventDefault();
        this.close();
      }
    });
  }

  bindEvents() {
    // Close on overlay click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });

    // Input handling
    this.input.addEventListener('input', (e) => {
      this.handleInput(e.target.value);
    });

    // Keyboard navigation
    this.input.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          this.navigateDown();
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.navigateUp();
          break;
        case 'Enter':
          e.preventDefault();
          this.selectCurrent();
          break;
      }
    });

    // Item clicks
    this.modal.addEventListener('click', (e) => {
      const item = e.target.closest('.command-palette-item');
      if (item) {
        this.handleItemClick(item);
      }
    });
  }

  handleInput(query) {
    clearTimeout(this.searchTimeout);

    if (!query.trim()) {
      // Show default view
      this.showDefaultView();
      return;
    }

    // Debounce search
    this.searchTimeout = setTimeout(() => {
      this.performSearch(query.trim());
    }, 300);
  }

  showDefaultView() {
    this.resultsSection.classList.add('hidden');
    this.loadingEl.classList.add('hidden');
    this.emptyEl.classList.add('hidden');
    document.getElementById('cpQuickActionsSection').classList.remove('hidden');

    if (this.recentSearches.length > 0) {
      this.recentSection.classList.remove('hidden');
    }

    this.updateCurrentItems();
    this.selectedIndex = 0;
    this.updateSelection();
  }

  async performSearch(query) {
    // Hide default sections, show loading
    document.getElementById('cpQuickActionsSection').classList.add('hidden');
    this.recentSection.classList.add('hidden');
    this.emptyEl.classList.add('hidden');
    this.resultsSection.classList.add('hidden');
    this.loadingEl.classList.remove('hidden');

    try {
      // Get content arrays
      const waContents = this.getWAContents();
      const gptPrompts = this.getGPTPrompts();

      let results = [];
      let searchTermsUsed = [query.toLowerCase()];

      // Try AI-enhanced search first
      if (this.aiAvailable && typeof aiEnhancedSearch === 'function') {
        try {
          // Search WhatsApp content
          const waResult = await aiEnhancedSearch(query, waContents);
          if (waResult && waResult.results) {
            results.push(...waResult.results.map(item => ({ ...item, type: 'whatsapp' })));
            searchTermsUsed = waResult.searchTermsUsed || searchTermsUsed;
          }

          // Search GPT prompts
          const gptResult = await aiEnhancedSearch(query, gptPrompts);
          if (gptResult && gptResult.results) {
            results.push(...gptResult.results.map(item => ({ ...item, type: 'prompt' })));
          }
        } catch (error) {
          console.warn('AI search failed, falling back to basic search:', error);
          results = this.basicSearch(query, waContents, gptPrompts);
        }
      } else {
        // Basic search fallback
        results = this.basicSearch(query, waContents, gptPrompts);
      }

      // Sort by score and limit
      results.sort((a, b) => (b._searchScore || 0) - (a._searchScore || 0));
      results = results.slice(0, 10);

      // Save to recent searches
      this.saveRecentSearch(query);

      // Render results
      this.loadingEl.classList.add('hidden');

      if (results.length === 0) {
        this.emptyEl.classList.remove('hidden');
        this.currentItems = [];
      } else {
        this.resultsTitle.textContent = `Results (${results.length})`;
        this.resultsContainer.innerHTML = results.map(item => this.renderItem(item, 'content')).join('');
        this.resultsSection.classList.remove('hidden');

        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }

        this.updateCurrentItems();
        this.selectedIndex = 0;
        this.updateSelection();
      }
    } catch (error) {
      console.error('Search error:', error);
      this.loadingEl.classList.add('hidden');
      this.emptyEl.classList.remove('hidden');
    }
  }

  basicSearch(query, waContents, gptPrompts) {
    const q = query.toLowerCase();
    const results = [];

    // Search WhatsApp content
    waContents.forEach(item => {
      const searchText = [
        item.title,
        item.content,
        item.category,
        ...(item.tags || [])
      ].join(' ').toLowerCase();

      if (searchText.includes(q)) {
        results.push({ ...item, type: 'whatsapp', _searchScore: 1 });
      }
    });

    // Search GPT prompts
    gptPrompts.forEach(item => {
      const searchText = [
        item.title,
        item.prompt,
        item.category,
        ...(item.tags || [])
      ].join(' ').toLowerCase();

      if (searchText.includes(q)) {
        results.push({ ...item, type: 'prompt', _searchScore: 1 });
      }
    });

    return results;
  }

  updateCurrentItems() {
    this.currentItems = Array.from(this.modal.querySelectorAll('.command-palette-item:not(.hidden)'));
  }

  navigateDown() {
    if (this.currentItems.length === 0) return;
    this.selectedIndex = Math.min(this.selectedIndex + 1, this.currentItems.length - 1);
    this.updateSelection();
  }

  navigateUp() {
    if (this.currentItems.length === 0) return;
    this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
    this.updateSelection();
  }

  updateSelection() {
    this.currentItems.forEach((item, index) => {
      item.classList.toggle('selected', index === this.selectedIndex);
    });

    // Scroll selected item into view
    const selected = this.currentItems[this.selectedIndex];
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }

  selectCurrent() {
    const selectedItem = this.currentItems[this.selectedIndex];
    if (selectedItem) {
      this.handleItemClick(selectedItem);
    }
  }

  handleItemClick(item) {
    const type = item.dataset.type;

    if (type === 'action') {
      this.executeAction(item.dataset.action);
    } else if (type === 'content') {
      const contentType = item.dataset.contentType;
      const id = item.dataset.id;
      this.close();
      this.onOpenContent(contentType, id);
    } else if (type === 'recent') {
      const query = item.dataset.query;
      this.input.value = query;
      this.handleInput(query);
    }
  }

  executeAction(action) {
    switch (action) {
      case 'search':
        this.input.value = '';
        this.input.placeholder = 'Type to search...';
        this.input.focus();
        break;

      case 'translate':
        this.close();
        this.promptTranslate();
        break;

      case 'summarize':
        this.close();
        this.promptSummarize();
        break;

      case 'add-whatsapp':
        this.close();
        this.onAddContent('whatsapp');
        break;

      case 'add-prompt':
        this.close();
        this.onAddContent('prompt');
        break;

      case 'toggle-theme':
        this.onToggleTheme();
        // Update theme icon
        const themeIcon = document.documentElement.getAttribute('data-theme') === 'dark' ? 'sun' : 'moon';
        const themeAction = this.quickActionsContainer.querySelector('[data-action="toggle-theme"] i');
        if (themeAction) {
          themeAction.setAttribute('data-lucide', themeIcon);
          if (typeof lucide !== 'undefined') lucide.createIcons();
        }
        break;

      default:
        console.log('Unknown action:', action);
    }
  }

  promptTranslate() {
    const text = prompt('Enter text to translate (German ↔ English):');
    if (!text) return;

    this.translateText(text);
  }

  async translateText(text) {
    if (!this.aiAvailable) {
      alert('AI translation is not available. Please configure an AI provider (Gemini or Ollama).');
      return;
    }

    try {
      // Use the unified translateText function from ai-search.js
      if (typeof translateText === 'function') {
        const result = await translateText(text);
        alert(`Translation:\n\n${result.trim()}`);
      } else {
        alert('Translation function not available');
      }
    } catch (error) {
      alert('Translation failed: ' + error.message);
    }
  }

  promptSummarize() {
    const text = prompt('Enter text to summarize:');
    if (!text) return;

    this.doSummarize(text);
  }

  async doSummarize(text) {
    if (!this.aiAvailable) {
      alert('AI summarization is not available. Please configure an AI provider (Gemini or Ollama).');
      return;
    }

    try {
      // Use the unified summarizeText function from ai-search.js
      if (typeof summarizeText === 'function') {
        const result = await summarizeText(text);
        alert(`Summary:\n\n${result.trim()}`);
      } else {
        alert('Summarize function not available');
      }
    } catch (error) {
      alert('Summarization failed: ' + error.message);
    }
  }

  // Recent Searches Management
  loadRecentSearches() {
    try {
      return JSON.parse(localStorage.getItem('cp_recent_searches') || '[]');
    } catch {
      return [];
    }
  }

  saveRecentSearch(query) {
    // Remove if exists
    this.recentSearches = this.recentSearches.filter(q => q !== query);
    // Add to front
    this.recentSearches.unshift(query);
    // Keep only last 5
    this.recentSearches = this.recentSearches.slice(0, 5);
    // Save
    localStorage.setItem('cp_recent_searches', JSON.stringify(this.recentSearches));
  }

  // Utility
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  // Open/Close
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.isOpen = true;
    this.overlay.classList.add('active');

    // Reset state
    this.input.value = '';
    this.selectedIndex = 0;
    this.showDefaultView();

    // Focus input
    setTimeout(() => {
      this.input.focus();
    }, 50);

    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  }

  close() {
    this.isOpen = false;
    this.overlay.classList.remove('active');

    // Restore body scroll
    document.body.style.overflow = '';
  }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CommandPalette };
}
