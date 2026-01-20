/**
 * Notion-style AI Chat Widget
 * Floating chat interface for talking to your content library
 */

class AIChatWidget {
  constructor(options = {}) {
    this.isOpen = false;
    this.messages = [];
    this.isTyping = false;

    this.init();
  }

  init() {
    this.createWidget();
    this.bindEvents();

    // Check AI status quietly
    if (window.checkOllamaStatus) {
      window.checkOllamaStatus().then(status => {
        const badge = document.querySelector('.ai-chat-badge');
        if (badge) badge.style.opacity = status ? '1' : '0.5';
      });
    }
  }

  createWidget() {
    // 1. Create Toggle Button
    const toggle = document.createElement('div');
    toggle.className = 'ai-chat-toggle';
    toggle.id = 'aiChatToggle';
    toggle.innerHTML = `<i data-lucide="sparkles"></i>`;
    document.body.appendChild(toggle);

    // 2. Create Chat Window
    const window = document.createElement('div');
    window.className = 'ai-chat-window';
    window.id = 'aiChatWindow';
    window.innerHTML = `
      <div class="ai-chat-header">
        <div class="ai-chat-title">
          <i data-lucide="bot"></i>
          AI Assistant
          <span class="ai-chat-badge">Beta</span>
        </div>
        <button class="btn-icon" id="aiChatClose" style="border:none;background:none;cursor:pointer;opacity:0.6;">
          <i data-lucide="x" style="width:18px;"></i>
        </button>
      </div>
      
      <div class="ai-chat-messages" id="aiChatMessages">
        <!-- Welcome Message -->
        <div class="ai-message ai">
          <div class="ai-avatar ai"><i data-lucide="sparkles" style="width:14px;"></i></div>
          <div class="ai-bubble">
            Hello! I'm your AI assistant. Ask me anything about your <b>WhatsApp templates</b> or <b>GPT prompts</b>!
          </div>
        </div>
      </div>
      
      <div class="ai-chat-input-area">
        <div class="ai-input-wrapper">
          <textarea class="ai-chat-input" id="aiChatInput" placeholder="Ask a question..." rows="1"></textarea>
          <button class="ai-send-btn" id="aiChatSend" disabled>
            <i data-lucide="arrow-up" style="width:16px;"></i>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(window);

    // Initialize icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  bindEvents() {
    const toggle = document.getElementById('aiChatToggle');
    const windowEl = document.getElementById('aiChatWindow');
    const closeBtn = document.getElementById('aiChatClose');
    const input = document.getElementById('aiChatInput');
    const sendBtn = document.getElementById('aiChatSend');

    // Toggle Open/Close
    toggle.addEventListener('click', () => {
      this.isOpen = !this.isOpen;
      windowEl.classList.toggle('active', this.isOpen);
      toggle.classList.toggle('active', this.isOpen);

      if (this.isOpen) {
        setTimeout(() => input.focus(), 100);
        this.scrollToBottom();
      }
    });

    closeBtn.addEventListener('click', () => {
      this.isOpen = false;
      windowEl.classList.remove('active');
      toggle.classList.remove('active');
    });

    // Auto-resize textarea
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 100) + 'px';
      sendBtn.disabled = !input.value.trim();
    });

    // Send on Enter
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Send on Click
    sendBtn.addEventListener('click', () => this.sendMessage());
  }

  async sendMessage() {
    const input = document.getElementById('aiChatInput');
    const msg = input.value.trim();
    if (!msg || this.isTyping) return;

    // 1. Add User Message
    this.addMessage(msg, 'user');
    input.value = '';
    input.style.height = 'auto';
    document.getElementById('aiChatSend').disabled = true;

    // 2. Add Typing Indicator
    this.showTyping();

    // 3. Get AI Response
    try {
      // Build context from content library
      const context = this.buildContext(msg);

      // Call AI (using the existing ai-search.js utilities if available)
      const response = await this.callAI(msg, context);

      this.hideTyping();
      this.addMessage(response, 'ai');

    } catch (error) {
      console.error(error);
      this.hideTyping();
      this.addMessage("Sorry, I encountered an error connecting to the AI. Please verify your API key or connection.", 'ai');
    }
  }

  addMessage(text, sender) {
    const container = document.getElementById('aiChatMessages');
    const div = document.createElement('div');
    div.className = `ai-message ${sender}`;

    // Format links/bold if needed (simple implementation)
    const formattedText = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');

    div.innerHTML = `
      <div class="ai-avatar ${sender}">
        <i data-lucide="${sender === 'ai' ? 'sparkles' : 'user'}" style="width:14px;"></i>
      </div>
      <div class="ai-bubble">${formattedText}</div>
    `;

    container.appendChild(div);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    this.scrollToBottom();
  }

  showTyping() {
    this.isTyping = true;
    const container = document.getElementById('aiChatMessages');
    const div = document.createElement('div');
    div.className = `ai-message ai typing-indicator`;
    div.innerHTML = `
      <div class="ai-avatar ai"><i data-lucide="sparkles" style="width:14px;"></i></div>
      <div class="ai-bubble">
        <div class="ai-typing">
          <div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div>
        </div>
      </div>
    `;
    container.appendChild(div);
    this.scrollToBottom();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  hideTyping() {
    this.isTyping = false;
    const indicator = document.querySelector('.typing-indicator');
    if (indicator) indicator.remove();
  }

  scrollToBottom() {
    const container = document.getElementById('aiChatMessages');
    container.scrollTop = container.scrollHeight;
  }

  buildContext(query) {
    // Get globally available content
    const wa = (window.waContents || []).map(i => `[WhatsApp] ${i.title}: ${i.content}`).join('\n').substring(0, 3000);
    const gpt = (window.gptPrompts || []).map(i => `[GPT] ${i.title}: ${i.prompt}`).join('\n').substring(0, 3000);
    return `Use the following content library to answer:\n\n${wa}\n\n${gpt}`;
  }

  async callAI(query, context) {
    // Get current AI status
    const status = typeof getAIStatus === 'function' ? getAIStatus() : { provider: 'none' };

    // Check if ai-search.js functions exist
    if (typeof callGemini === 'function' && status.provider === 'gemini') {
      const prompt = `You are a helpful assistant for an investment content library.
      
Context:
${context}

User Question: "${query}"

Answer politely and briefly using the context provided. If the answer isn't in the context, say so but try to be helpful.`;

      return await callGemini(prompt);
    }

    // Fallback to Ollama if available
    if (typeof callOllama === 'function' && status.provider === 'ollama') {
      return await callOllama(`Context:\n${context}\n\nQuestion: ${query}`);
    }

    // Direct fetch (backup)
    throw new Error('No AI provider available');
  }
}

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    new AIChatWidget();
  }, 1000);
});
