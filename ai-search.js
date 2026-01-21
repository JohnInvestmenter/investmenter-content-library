/**
 * AI-Powered Search Enhancement for Content Library
 * SECURE MODE: Calls Vercel Serverless Function (/api/ai-chat)
 */

// ============ CONFIGURATION ============
// Keys are now securely stored in Vercel Environment Variables!
// No need to paste them here.

// ============ AI PROVIDER DETECTION ============
let currentProvider = 'unknown';

/**
 * Check which AI provider is available via our Server Proxy
 */
async function detectAIProvider() {
  console.log('Checking AI Server connection...');

  // Test connection to our own API
  try {
    const response = await fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'test',
        context: 'test',
        provider: 'groq' // Default to Groq
      })
    });

    if (response.ok) {
      currentProvider = 'server-groq';
      console.log('✅ AI Provider: Vercel Server (Groq)');
      return 'server-groq';
    } else {
      console.warn('Server check failed, trying Gemini...');
      // Try Gemini if Groq fails
      const resp2 = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'test', context: 'test', provider: 'gemini' })
      });

      if (resp2.ok) {
        currentProvider = 'server-gemini';
        console.log('✅ AI Provider: Vercel Server (Gemini)');
        return 'server-gemini';
      }

      // Try Ollama Tunnel (Cloudflare)
      const resp3 = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'test', context: 'test', provider: 'ollama' })
      });

      if (resp3.ok) {
        currentProvider = 'server-ollama';
        console.log('✅ AI Provider: Vercel Server (Ollama Tunnel)');
        return 'server-ollama';
      }
    }
  } catch (e) {
    console.warn('AI Server unreachable:', e);
  }

  // Fallback to local Ollama
  try {
    const response = await fetch('http://localhost:11434', { method: 'GET', signal: AbortSignal.timeout(1000) });
    if (response.ok) {
      currentProvider = 'ollama';
      console.log('✅ AI Provider: Ollama (local)');
      return 'ollama';
    }
  } catch (e) { }

  currentProvider = 'none';
  return 'none';
}

/**
 * Call AI via Secure Proxy
 */
async function callAI(prompt, context = '', preferredProvider = 'auto') {
  // Determine provider to use
  let providerToUse = preferredProvider;

  if (providerToUse === 'auto') {
    if (currentProvider === 'server-gemini') providerToUse = 'gemini';
    else if (currentProvider === 'server-ollama') providerToUse = 'ollama';
    else if (currentProvider === 'ollama') return callOllama(prompt);
    else providerToUse = 'groq'; // Default auto
  }

  // Direct Ollama Call (Bypass Vercel Server to avoid Timeout)
  if (providerToUse === 'ollama') {
    let tunnelUrl = 'http://localhost:11434';
    try {
      // Fetch tunnel URL from Vercel Env (exposed via API)
      const cfg = await fetch('/api/config').then(r => r.json());
      if (cfg.ollamaTunnelUrl) tunnelUrl = cfg.ollamaTunnelUrl;
    } catch (e) { console.warn('Could not fetch tunnel config', e); }

    return callOllamaDirect(prompt, context, tunnelUrl);
  }

  try {
    const response = await fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: prompt,
        context: context,
        provider: providerToUse
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      let errJson;
      try { errJson = JSON.parse(errText); } catch (e) { }
      throw new Error(errJson?.error || `Server Error: ${errText.substring(0, 100)}`);
    }

    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data.reply;

  } catch (error) {
    console.error('AI Call Failed:', error);
    throw error;
  }
}

// ... Keep existing helper functions (Ollama, basicSearch) ...

// Direct Client-Side Call to Ollama Tunnel
async function callOllamaDirect(prompt, context, baseUrl) {
  // Ensure we hit the API endpoint
  const url = baseUrl.endsWith('/api/generate') ? baseUrl : `${baseUrl.replace(/\/$/, '')}/api/generate`;

  console.log('Calling Ollama Tunnel Direct:', url);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3.1:8b',
      prompt: `Context:\n${context.substring(0, 10000)} ...\n\nQuestion: ${prompt}`,
      stream: false,
      options: { temperature: 0.3 }
    })
  });

  if (!response.ok) throw new Error(`Ollama Tunnel Error: ${response.status}`);
  const data = await response.json();
  return data.response;
}

async function callOllama(prompt) {
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3.1:8b',
      prompt: prompt,
      stream: false
    })
  });
  if (!response.ok) throw new Error('Ollama Error');
  const data = await response.json();
  return data.response;
}

// Simple wrappers
async function enhanceSearchQuery(query) { return null; } // Simplified for now
async function translateText(text) { return await callAI(`Translate: ${text}`); }
async function summarizeText(text) { return await callAI(`Summarize: ${text}`); }

async function aiEnhancedSearch(query, content) {
  return { results: basicSearch(query, content) };
}

function basicSearch(query, items) {
  const q = query.toLowerCase();
  return items.filter(i => (i.title + i.content).toLowerCase().includes(q));
}

// Helper to init
async function initAISearch() {
  await detectAIProvider();
  return currentProvider !== 'none';
}

function getAIStatus() {
  return {
    provider: currentProvider,
    isAvailable: currentProvider !== 'none',
    displayName: currentProvider.includes('server') ? 'Secure Server AI' : 'None'
  };
}

// Export
if (typeof module !== 'undefined') {
  module.exports = {
    initAISearch, getAIStatus, callAI,
    enhanceSearchQuery, translateText, summarizeText, aiEnhancedSearch
  };
}
