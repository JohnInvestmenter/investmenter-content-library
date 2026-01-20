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
    // No auto-check on init
  }

  createWidget() {
    const toggle = document.createElement('div');
    toggle.className = 'ai-chat-toggle';
    toggle.id = 'aiChatToggle';
    toggle.innerHTML = `<i data-lucide="sparkles"></i>`;
    document.body.appendChild(toggle);

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

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  bindEvents() {
    const toggle = document.getElementById('aiChatToggle');
    const windowEl = document.getElementById('aiChatWindow');
    const closeBtn = document.getElementById('aiChatClose');
    const input = document.getElementById('aiChatInput');
    const sendBtn = document.getElementById('aiChatSend');

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

    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 100) + 'px';
      sendBtn.disabled = !input.value.trim();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    sendBtn.addEventListener('click', () => this.sendMessage());
  }

  async sendMessage() {
    const input = document.getElementById('aiChatInput');
    const msg = input.value.trim();
    if (!msg || this.isTyping) return;

    this.addMessage(msg, 'user');
    input.value = '';
    input.style.height = 'auto';
    document.getElementById('aiChatSend').disabled = true;

    this.showTyping();

    try {
      const context = this.buildContext(msg);

      // Ensure AI is initialized (Lazy Load)
      if (typeof getAIStatus === 'function') {
        let status = getAIStatus();
        if (status.provider === 'none' || status.provider === 'unknown') {
          await detectAIProvider();
        }
      }

      // Call Secure Proxy
      const response = await callAI(msg, context);

      this.hideTyping();
      this.addMessage(response, 'ai');

    } catch (error) {
      console.error('AI Chat Error:', error);
      this.hideTyping();
      this.addMessage(`⚠️ **Error:** ${error.message || 'Connection failed'}`, 'ai');
    }
  }

  addMessage(text, sender) {
    const container = document.getElementById('aiChatMessages');
    const div = document.createElement('div');
    div.className = `ai-message ${sender}`;
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
    const wa = (window.waContents || []).map(i => `[WhatsApp] ${i.title}: ${i.content}`).join('\n\n');
    const gpt = (window.gptPrompts || []).map(i => `[GPT] ${i.title}: ${i.prompt}`).join('\n\n');
    // Combine and limit to a safe number for Groq Free Tier (Limit ~6000 tokens)
    // 20,000 chars is roughly 4k-5k tokens.
    return `Use the following content library to answer:\n\n${wa}\n\n${gpt}`.substring(0, 20000);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    new AIChatWidget();
  }, 1000);
});
