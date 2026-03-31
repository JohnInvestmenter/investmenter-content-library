export const config = {
    runtime: 'edge',
};

export default async function handler(req) {
    return new Response(JSON.stringify({
        ollamaTunnelUrl: process.env.OLLAMA_TUNNEL_URL || ''
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
}
