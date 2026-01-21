export const config = {
    runtime: 'edge', // Fast startup for AI
};

export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    try {
        const { message, context, provider = 'groq' } = await req.json();

        // 1. SELECT PROVIDER & KEY
        let apiKey = '';
        let apiUrl = '';
        let body = {};
        const headers = { 'Content-Type': 'application/json' };

        // === GROQ CONFIG ===
        if (provider === 'groq') {
            apiKey = process.env.GROQ_API_KEY;
            if (!apiKey) throw new Error('GROQ_API_KEY not configured in Vercel');

            apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
            headers['Authorization'] = `Bearer ${apiKey}`;
            body = {
                model: 'llama-3.1-8b-instant',
                messages: [
                    { role: 'system', content: `You are a helpful assistant for an investment library. Context:\n${context}` },
                    { role: 'user', content: message }
                ],
                temperature: 0.3
            };
        }

        // === GEMINI CONFIG ===
        else if (provider === 'gemini') {
            apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) throw new Error('GEMINI_API_KEY not configured in Vercel');

            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
            body = {
                contents: [{
                    parts: [{ text: `Context:\n${context}\n\nQuestion: ${message}` }]
                }]
            };
        }

        // === OLLAMA TUNNEL CONFIG ===
        else if (provider === 'ollama') {
            // Tunnel URL provided by user
            apiUrl = 'https://nine-dealt-suggestions-density.trycloudflare.com/api/generate';
            body = {
                model: 'llama3.1:8b', // Confirmed via previous curl check
                prompt: `Context:\n${context}\n\nQuestion: ${message}`,
                stream: false,
                options: { temperature: 0.3 }
            };
        }

        // 2. CALL AI PROVIDER
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const err = await response.text();
            return new Response(JSON.stringify({ error: `Provider Error: ${err}` }), { status: 500 });
        }

        const data = await response.json();
        let reply = '';

        // Extract reply based on provider
        if (provider === 'groq') reply = data.choices[0]?.message?.content;
        if (provider === 'gemini') reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (provider === 'ollama') reply = data.response;

        return new Response(JSON.stringify({ reply }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
