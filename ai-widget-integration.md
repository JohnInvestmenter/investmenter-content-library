# AI Assistant Widget - Integration Guide

## 🎯 What You're Adding

A Notion-style AI chat assistant that floats in the bottom-right corner of your Content Library.

**Features:**
- ✨ Floating button with welcome hint
- 💬 Chat interface
- 🔍 Search content with AI
- 🌐 Translate German ↔ English
- ❓ Quick action buttons
- 📱 Mobile responsive

---

## 🚀 Quick Integration (3 Steps)

### Step 1: Test the Widget First

Open `ai-assistant-widget-simple.html` in your browser to see how it works:

```bash
# Open in browser
start ai-assistant-widget-simple.html
```

Make sure:
1. ✅ Ollama is running
2. ✅ Floating button appears in bottom-right
3. ✅ Chat opens when clicked
4. ✅ You can send messages

---

### Step 2: Add CSS to index.html

Open `index.html` and find the `<head>` section. Add this line:

```html
<head>
  <!-- Existing styles -->
  <link rel="stylesheet" href="ai-widget-styles.css">
</head>
```

---

### Step 3: Add JavaScript Before `</body>`

Find the closing `</body>` tag in index.html (at the very end, around line 3688).

Add this **BEFORE** the `</body>` tag:

```html
<!-- AI Assistant Widget -->
<link rel="stylesheet" href="ai-widget-styles.css">
<script>
// Copy the entire AIAssistant class from ai-assistant-widget-simple.html
// Lines 74-330
[PASTE THE AIASSISTANT CLASS HERE]

// Initialize
window.aiAssistant = new AIAssistant();
</script>

</body>
</html>
```

---

## 📝 Full Integration Code

Here's the exact code to add before `</body>`:

```html
<!-- AI Assistant Widget -->
<link rel="stylesheet" href="ai-widget-styles.css">
<script>
class AIAssistant {
  constructor() {
    this.isOpen = false;
    this.ollamaAvailable = false;
    this.isProcessing = false;
    this.messageCount = 0;
    this.init();
  }

  async init() {
    this.ollamaAvailable = await this.checkOllama();
    this.createWidget();
    this.bindEvents();
    if (this.ollamaAvailable) {
      setTimeout(() => this.showWelcomeHint(), 1000);
    }
  }

  async checkOllama() {
    try {
      const response = await fetch('http://localhost:11434', { 
        method: 'GET', 
        signal: AbortSignal.timeout(2000) 
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  createWidget() {
    const widget = document.createElement('div');
    widget.id = 'ai-assistant-widget';
    widget.innerHTML = `
      <div id="ai-fab" class="ai-fab ${this.ollamaAvailable ? '' : 'ai-disabled'}">
        <i data-lucide="sparkles"></i>
        <span class="ai-fab-badge" style="display: none;"></span>
      </div>

      <div id="ai-chat-window" class="ai-chat-window" style="display: none;">
        <div class="ai-chat-header">
          <div class="flex items-center gap-2 flex-1">
            <i data-lucide="sparkles" style="width: 20px; height: 20px;"></i>
            <div>
              <div class="font-semibold">AI Assistant</div>
              <div class="text-xs text-[var(--muted-ink)]">
                ${this.ollamaAvailable ? 'Ready to help ✨' : 'Ollama not running'}
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button id="ai-close-btn" class="ai-header-btn">
              <i data-lucide="x"></i>
            </button>
          </div>
        </div>

        <div class="ai-quick-actions">
          <button class="ai-quick-btn" data-action="search">
            <i data-lucide="search"></i>
            <span>Search</span>
          </button>
          <button class="ai-quick-btn" data-action="translate">
            <i data-lucide="languages"></i>
            <span>Translate</span>
          </button>
          <button class="ai-quick-btn" data-action="summarize">
            <i data-lucide="file-text"></i>
            <span>Summarize</span>
          </button>
          <button class="ai-quick-btn" data-action="help">
            <i data-lucide="help-circle"></i>
            <span>Help</span>
          </button>
        </div>

        <div class="ai-chat-messages" id="ai-messages"></div>

        <div class="ai-chat-input-wrapper">
          <textarea id="ai-input" class="ai-chat-input"
            placeholder="${this.ollamaAvailable ? 'Ask me anything...' : 'Start Ollama first'}"
            rows="1" ${!this.ollamaAvailable ? 'disabled' : ''}></textarea>
          <button id="ai-send-btn" class="ai-send-btn" ${!this.ollamaAvailable ? 'disabled' : ''}>
            <i data-lucide="send"></i>
          </button>
        </div>

        <div class="ai-footer">
          <span class="text-xs text-[var(--muted-ink)]">Powered by Llama • Running locally</span>
        </div>
      </div>
    `;

    document.body.appendChild(widget);
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  bindEvents() {
    document.getElementById('ai-fab').addEventListener('click', () => this.openChat());
    document.getElementById('ai-close-btn').addEventListener('click', () => this.closeChat());
    document.getElementById('ai-send-btn').addEventListener('click', () => this.handleSend());

    const input = document.getElementById('ai-input');
    input.addEventListener('input', (e) => {
      e.target.style.height = 'auto';
      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    document.querySelectorAll('.ai-quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.handleQuickAction(btn.getAttribute('data-action'));
      });
    });
  }

  openChat() {
    document.getElementById('ai-fab').style.display = 'none';
    document.getElementById('ai-chat-window').style.display = 'flex';
    setTimeout(() => document.getElementById('ai-input').focus(), 100);
    document.querySelector('.ai-fab-badge').style.display = 'none';
  }

  closeChat() {
    document.getElementById('ai-chat-window').style.display = 'none';
    document.getElementById('ai-fab').style.display = 'flex';
  }

  showWelcomeHint() {
    const badge = document.querySelector('.ai-fab-badge');
    badge.textContent = '👋';
    badge.style.display = 'flex';
    setTimeout(() => badge.style.display = 'none', 5000);
  }

  async handleSend() {
    const input = document.getElementById('ai-input');
    const message = input.value.trim();
    if (!message || this.isProcessing) return;

    input.value = '';
    input.style.height = 'auto';

    this.addMessage('user', message);
    this.isProcessing = true;
    const typingId = this.addTypingIndicator();

    try {
      const response = await this.getAIResponse(message);
      this.removeTypingIndicator(typingId);
      this.addMessage('assistant', response);
    } catch (error) {
      this.removeTypingIndicator(typingId);
      this.addMessage('assistant', '❌ Error: ' + error.message, 'error');
    } finally {
      this.isProcessing = false;
    }
  }

  handleQuickAction(action) {
    const prompts = {
      search: 'Search my content for: ',
      translate: 'Translate to German: ',
      summarize: 'Summarize this content: ',
      help: 'What can you help me with?'
    };

    document.getElementById('ai-input').value = prompts[action] || '';
    document.getElementById('ai-input').focus();

    if (action === 'help') this.handleSend();
  }

  async getAIResponse(userMessage) {
    if (userMessage.toLowerCase().includes('help')) {
      return `I can help you with:

🔍 Search - Find content in your library
🌐 Translate - German ↔ English translation  
📄 Summarize - Summarize your content
💬 Chat - Ask me anything!

Just type naturally!`;
    }

    const prompt = `You are a helpful AI assistant. Keep responses concise.\n\nUser: ${userMessage}\n\nAssistant:`;

    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.1:8b',
        prompt: prompt,
        stream: false,
        options: { temperature: 0.7, num_predict: 300 }
      })
    });

    if (!response.ok) throw new Error('AI request failed');
    const data = await response.json();
    return data.response.trim();
  }

  addMessage(role, content, type = '') {
    const messagesDiv = document.getElementById('ai-messages');
    const messageEl = document.createElement('div');
    messageEl.className = `ai-message ${role} ${type}`;
    messageEl.id = 'msg-' + (this.messageCount++);

    messageEl.innerHTML = `
      <div class="ai-message-avatar">
        <i data-lucide="${role === 'user' ? 'user' : 'sparkles'}"></i>
      </div>
      <div class="ai-message-content">${this.escapeHtml(content)}</div>
    `;

    messagesDiv.appendChild(messageEl);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  addTypingIndicator() {
    const messagesDiv = document.getElementById('ai-messages');
    const typingId = 'typing-' + Date.now();
    const typingEl = document.createElement('div');
    typingEl.className = 'ai-message assistant';
    typingEl.id = typingId;

    typingEl.innerHTML = `
      <div class="ai-message-avatar"><i data-lucide="sparkles"></i></div>
      <div class="ai-message-content">
        <div class="ai-typing-indicator">
          <div class="ai-typing-dot"></div>
          <div class="ai-typing-dot"></div>
          <div class="ai-typing-dot"></div>
        </div>
      </div>
    `;

    messagesDiv.appendChild(typingEl);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    return typingId;
  }

  removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize AI Assistant
window.aiAssistant = new AIAssistant();
</script>
</body>
</html>
```

---

## ✅ Verification

After adding the code:

1. Open `index.html` in browser
2. Look for ✨ button in bottom-right corner
3. Click it - chat window should open
4. Try typing: "What can you help me with?"
5. AI should respond!

---

## 🎨 Customization

### Change Colors

Edit `ai-widget-styles.css`:

```css
/* Change floating button color */
.ai-fab {
  background: #your-color;
}

/* Change message bubble colors */
.ai-message.user .ai-message-content {
  background: #your-brand-color;
}
```

### Change AI Model

In the JavaScript code, find:

```javascript
model: 'llama3.1:8b',
```

Change to:
- `'qwen2.5:7b'` for better German
- `'llama3.2:3b'` for faster responses

---

## 📱 Mobile Support

The widget is automatically responsive:
- Desktop: 420px wide, bottom-right
- Mobile: Full screen overlay

---

## 🐛 Troubleshooting

### Widget doesn't appear
- Check console for errors (F12)
- Verify `ai-widget-styles.css` is loaded
- Make sure code is inside `<script>` tags

### AI doesn't respond
- Check Ollama is running: `ollama serve`
- Verify model is downloaded: `ollama list`
- Check console for fetch errors

### Styling looks wrong
- Make sure `ai-widget-styles.css` path is correct
- Check if there are CSS conflicts with existing styles
- Try adding `!important` to widget styles if needed

---

## 🚀 Next Steps

Once integrated, you can enhance the widget:

1. **Connect to Content Search** - Make "Search" button actually search your Notion content
2. **Add Conversation History** - Save chat history to localStorage
3. **Voice Input** - Add speech-to-text for hands-free use
4. **Shortcuts** - Add keyboard shortcut (Ctrl+K) to open chat

---

## 📸 Screenshots

**Closed (Floating Button):**
- Golden sparkle button in bottom-right
- Small badge showing "👋" as welcome hint

**Open (Chat Interface):**
- Clean chat window, Notion-style
- Quick action buttons at top
- Message history in middle
- Input field at bottom
- "Powered by Llama" footer

---

That's it! Your Content Library now has a built-in AI assistant. 🎉
