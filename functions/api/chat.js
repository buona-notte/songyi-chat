// Cloudflare Pages Function → /api/chat
// 代理转发 DeepSeek 请求，API Key 藏在 env.DEEPSEEK_KEY 里（部署时在 Cloudflare 后台设置）

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: corsHeaders()
      });
    }

    const key = env.DEEPSEEK_KEY;
    if (!key) {
      return new Response(JSON.stringify({ error: 'Server missing DEEPSEEK_KEY' }), {
        status: 500,
        headers: corsHeaders()
      });
    }

    let payload;
    try {
      payload = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: corsHeaders()
      });
    }

    // 只转发允许的字段，防止别人用你 Key 乱调其他模型
    const safe = {
      model: payload.model || 'deepseek-chat',
      messages: payload.messages,
      temperature: typeof payload.temperature === 'number' ? payload.temperature : 0.85,
      max_tokens: typeof payload.max_tokens === 'number' ? Math.min(payload.max_tokens, 1000) : 500,
      stream: false
    };

    try {
      const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + key
        },
        body: JSON.stringify(safe)
      });

      const text = await resp.text();
      const headers = corsHeaders();
      headers['Content-Type'] = 'application/json';
      return new Response(text, { status: resp.status, headers });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Upstream failed: ' + err.message }), {
        status: 502,
        headers: corsHeaders()
      });
    }
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}
