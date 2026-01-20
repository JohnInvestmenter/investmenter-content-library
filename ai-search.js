/**
 * AI-Powered Search Enhancement for Content Library
 *
 * This module integrates with Google Gemini API to provide:
 * - Automatic German/English translation
 * - Query expansion with synonyms
 * - Smart keyword suggestions
 * - Search term enhancement
 */

// ============ CONFIGURATION ============
// Get your free API key from: https://aistudio.google.com/app/apikey
const GEMINI_API_KEY = 'AIzaSyDHvtoV5Egpw11pLFnbwv8cjhWs-Oy4oh8'; // <-- PASTE YOUR GEMINI API KEY HERE
const GEMINI_MODEL = 'gemini-2.5-flash'; // Newer model, may have separate quota
const GEMINI_API = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// Legacy Ollama config (fallback)
const OLLAMA_API = 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = 'llama3.1:8b';

// ============ AI PROVIDER DETECTION ============
let currentProvider = 'none'; // 'gemini', 'ollama', or 'none'

/**
 * Check which AI provider is available
 */
async function detectAIProvider() {
  // First, check if Gemini API key is configured
  if (GEMINI_API_KEY && GEMINI_API_KEY.length > 10) {
    try {
      const testResponse = await fetch(GEMINI_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Hello' }] }],
          generationConfig: { maxOutputTokens: 10 }
        }),
        signal: AbortSignal.timeout(5000)
      });

      if (testResponse.ok) {
        currentProvider = 'gemini';
        console.log('✅ AI Provider: Google Gemini');
        return 'gemini';
      }
    } catch (e) {
      console.warn('Gemini API check failed:', e.message);
    }
  }

  // Fallback: Check if Ollama is running locally
  try {
    const response = await fetch('http://localhost:11434', {
      method: 'GET',
      signal: AbortSignal.timeout(2000)
    });
    if (response.ok) {
      currentProvider = 'ollama';
      console.log('✅ AI Provider: Ollama (local)');
      return 'ollama';
    }
  } catch (e) {
    console.warn('Ollama not available');
  }

  currentProvider = 'none';
  console.log('⚠️ No AI provider available - using basic search');
  return 'none';
}

/**
 * Check if any AI is available
 */
async function checkOllamaStatus() {
  const provider = await detectAIProvider();
  return provider !== 'none';
}

/**
 * Call AI to generate a response
 */
async function callAI(prompt) {
  if (currentProvider === 'gemini') {
    return await callGemini(prompt);
  } else if (currentProvider === 'ollama') {
    return await callOllama(prompt);
  }
  throw new Error('No AI provider available');
}

/**
 * Call Gemini API
 */
async function callGemini(prompt) {
  const response = await fetch(GEMINI_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 500
      }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Gemini API error');
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * Call Ollama API (legacy/fallback)
 */
async function callOllama(prompt) {
  const response = await fetch(OLLAMA_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.3,
        num_predict: 500
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status}`);
  }

  const data = await response.json();
  return data.response || '';
}

/**
 * Enhance search query using AI
 * @param {string} query - User's search query
 * @returns {Promise<Object>} Enhanced search data
 */
async function enhanceSearchQuery(query) {
  if (!query || query.trim().length < 2) {
    return null;
  }

  // Ensure we have a provider
  if (currentProvider === 'none') {
    await detectAIProvider();
  }

  if (currentProvider === 'none') {
    return null;
  }

  const prompt = `You are a search assistant for a business content library.

User query: "${query}"

Task: Analyze this search query and provide:
1. Detect if it's German or English
2. Translate to the other language
3. Generate 5-10 related search keywords/phrases
4. Expand abbreviations if any
5. Suggest better query phrasing

IMPORTANT: Respond ONLY with valid JSON, no other text.

JSON format:
{
  "detectedLanguage": "en or de",
  "originalQuery": "${query}",
  "translatedQuery": "translation here",
  "searchTerms": ["term1", "term2", "term3", ...],
  "expandedTerms": ["expanded1", "expanded2", ...],
  "suggestedQuery": "better phrasing of query"
}`;

  try {
    const responseText = await callAI(prompt);

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('No valid JSON in AI response:', responseText);
      return null;
    }

    const result = JSON.parse(jsonMatch[0]);
    return result;

  } catch (error) {
    console.error('AI search enhancement failed:', error);
    return null;
  }
}

/**
 * Translate text using AI
 */
async function translateText(text) {
  if (currentProvider === 'none') {
    await detectAIProvider();
  }

  if (currentProvider === 'none') {
    throw new Error('No AI provider available');
  }

  const prompt = `Translate this text. If it's German, translate to English. If it's English, translate to German.

Text: "${text}"

Provide only the translation, nothing else.`;

  return await callAI(prompt);
}

/**
 * Summarize text using AI
 */
async function summarizeText(text) {
  if (currentProvider === 'none') {
    await detectAIProvider();
  }

  if (currentProvider === 'none') {
    throw new Error('No AI provider available');
  }

  const prompt = `Summarize this text in 2-3 sentences:

${text}`;

  return await callAI(prompt);
}

/**
 * Search content with AI enhancement
 * @param {string} query - User query
 * @param {Array} contentItems - Array of content items to search
 * @returns {Promise<Object>} Filtered and ranked results
 */
async function aiEnhancedSearch(query, contentItems) {
  // Get AI enhancement
  const enhancement = await enhanceSearchQuery(query);

  if (!enhancement) {
    // Fallback to basic search if AI fails
    return {
      results: basicSearch(query, contentItems),
      enhancement: null,
      searchTermsUsed: [query.toLowerCase()]
    };
  }

  // Build comprehensive search terms from AI response
  const allSearchTerms = [
    query.toLowerCase(),
    enhancement.translatedQuery?.toLowerCase(),
    enhancement.suggestedQuery?.toLowerCase(),
    ...(enhancement.searchTerms || []).map(t => t.toLowerCase()),
    ...(enhancement.expandedTerms || []).map(t => t.toLowerCase())
  ].filter(Boolean);

  // Remove duplicates
  const uniqueTerms = [...new Set(allSearchTerms)];

  console.log('🔍 AI Enhanced Search Terms:', uniqueTerms);

  // Score and filter content
  const results = contentItems.map(item => {
    let score = 0;
    const searchableText = [
      item.title,
      item.content || item.prompt,
      item.formattedContent,
      item.category,
      ...(item.tags || [])
    ].join(' ').toLowerCase();

    // Calculate relevance score
    uniqueTerms.forEach(term => {
      if (searchableText.includes(term)) {
        // Exact match in title = highest score
        if (item.title?.toLowerCase().includes(term)) {
          score += 10;
        }
        // Match in content
        else if ((item.content || item.prompt || '').toLowerCase().includes(term)) {
          score += 5;
        }
        // Match in tags
        else if ((item.tags || []).some(tag => tag.toLowerCase().includes(term))) {
          score += 3;
        }
        // Match in category
        else if (item.category?.toLowerCase().includes(term)) {
          score += 2;
        }
        // Any other match
        else {
          score += 1;
        }
      }
    });

    return { ...item, _searchScore: score };
  });

  // Filter items with score > 0 and sort by score
  const filtered = results
    .filter(item => item._searchScore > 0)
    .sort((a, b) => b._searchScore - a._searchScore);

  return {
    results: filtered,
    enhancement: enhancement,
    searchTermsUsed: uniqueTerms
  };
}

/**
 * Basic fallback search (without AI)
 */
function basicSearch(query, contentItems) {
  const q = query.toLowerCase();
  return contentItems.filter(item => {
    const searchText = [
      item.title,
      item.content || item.prompt,
      item.category,
      ...(item.tags || [])
    ].join(' ').toLowerCase();

    return searchText.includes(q);
  });
}

/**
 * Initialize AI search
 */
async function initAISearch() {
  const provider = await detectAIProvider();
  return provider !== 'none';
}

/**
 * Get current AI provider status
 */
function getAIStatus() {
  return {
    provider: currentProvider,
    isAvailable: currentProvider !== 'none',
    displayName: currentProvider === 'gemini' ? 'Google Gemini' :
      currentProvider === 'ollama' ? 'Ollama (local)' : 'None'
  };
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    enhanceSearchQuery,
    checkOllamaStatus,
    aiEnhancedSearch,
    basicSearch,
    initAISearch,
    translateText,
    summarizeText,
    getAIStatus,
    detectAIProvider
  };
}

// Auto-initialization removed to save quota. 
// Widget will trigger initAISearch() when opened or used.
