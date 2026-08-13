const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache'
};

/**
 * In-Memory TurboStream Deserializer
 * Recursively decodes React Router / Remix pointer-based array graphs
 */
function decodeChatGPTTurboStream(arr) {
  function decodeNode(idx, visited = new Set()) {
    if (typeof idx === 'number') {
      if (idx < 0 || idx >= arr.length) return null;
      if (visited.has(idx)) return `<ref_${idx}>`;
      visited.add(idx);
      const val = arr[idx];
      return resolveVal(val, visited);
    }
    return resolveVal(idx, visited);
  }

  function resolveVal(val, visited) {
    if (val === null || typeof val !== 'object') {
      return val;
    }

    if (Array.isArray(val)) {
      return val.map((item) => decodeNode(item, new Set(visited)));
    }

    const res = {};
    for (const [k, v] of Object.entries(val)) {
      if (k.startsWith('_') && /^\d+$/.test(k.slice(1))) {
        const keyIdx = parseInt(k.slice(1), 10);
        const keyResolved = decodeNode(keyIdx, new Set(visited));
        if (
          keyResolved === 'statsigGateEvaluationsPromise' ||
          keyResolved === 'root' ||
          keyResolved === 'entryContext'
        ) {
          continue;
        }
        res[String(keyResolved)] = decodeNode(v, new Set(visited));
      } else {
        if (
          k === 'statsigGateEvaluationsPromise' ||
          k === 'root' ||
          k === 'entryContext'
        ) {
          continue;
        }
        res[k] = decodeNode(v, new Set(visited));
      }
    }
    return res;
  }

  let serverRespIdx = null;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === 'serverResponse') {
      serverRespIdx = i + 1;
      break;
    }
  }

  let data = null;
  if (serverRespIdx !== null) {
    const decodedServerResp = decodeNode(serverRespIdx);
    if (decodedServerResp && typeof decodedServerResp === 'object') {
      if (decodedServerResp.data) {
        data = decodedServerResp.data;
        if (data.data && typeof data.data === 'object') {
          data = data.data;
        }
      } else {
        data = decodedServerResp;
      }
    }
  }

  if (!data || !data.linear_conversation) {
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] === 'mapping' || arr[i] === 'linear_conversation') {
        for (let j = Math.max(0, i - 20); j < i; j++) {
          if (typeof arr[j] === 'object' && arr[j] !== null) {
            const candidate = decodeNode(j);
            if (
              candidate &&
              typeof candidate === 'object' &&
              (candidate.mapping || candidate.linear_conversation)
            ) {
              data = candidate;
              break;
            }
          }
        }
        if (data) break;
      }
    }
  }

  return data;
}

function extractChatGPTTurns(data) {
  if (!data) return null;

  const title = data.title || 'ChatGPT Conversation';
  const createTime = data.create_time ? new Date(data.create_time * 1000).toISOString() : null;
  const updateTime = data.update_time ? new Date(data.update_time * 1000).toISOString() : null;
  const linearConv = data.linear_conversation || [];

  const turns = [];

  for (const node of linearConv) {
    const msg = node && node.message;
    if (!msg) continue;

    const author = msg.author || {};
    const role = author.role || 'unknown';
    const metadata = msg.metadata || {};

    if (metadata.is_visually_hidden_from_conversation) continue;
    if (role === 'system' && (!msg.content || !msg.content.parts || !msg.content.parts[0])) continue;

    const content = msg.content || {};
    const parts = content.parts || [];

    const textParts = [];
    for (const p of parts) {
      if (typeof p === 'string') {
        textParts.push(p);
      } else if (p && typeof p === 'object') {
        if (p.content_type === 'text') {
          textParts.push(p.text || '');
        } else if (p.content_type === 'code') {
          textParts.push(`\`\`\`${p.language || ''}\n${p.text || ''}\n\`\`\``);
        } else if (p.content_type === 'execution_output') {
          textParts.push(`\`\`\`output\n${p.text || ''}\n\`\`\``);
        } else {
          textParts.push(JSON.stringify(p, null, 2));
        }
      } else if (p !== null && p !== undefined) {
        textParts.push(String(p));
      }
    }

    const fullText = textParts.filter((t) => t && t.trim()).join('\n\n').trim();
    if (!fullText) continue;

    let timeStr = null;
    if (msg.create_time) {
      timeStr = new Date(msg.create_time * 1000).toISOString();
    }

    const roleLabel = role === 'user' ? 'USER' : role === 'assistant' ? 'CHATGPT' : role.toUpperCase();

    turns.push({
      id: msg.id,
      role: role,
      role_label: roleLabel,
      time: timeStr,
      content: fullText
    });
  }

  return {
    platform: 'chatgpt',
    platform_name: 'ChatGPT',
    platform_color: '#10b981',
    title,
    create_time: createTime,
    update_time: updateTime,
    total_turns: turns.length,
    turns
  };
}

/**
 * Main Extraction API
 */
app.post('/api/extract', async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'A valid ChatGPT share link is required.' });
  }

  const cleanUrl = url.trim();
  const match = cleanUrl.match(/chatgpt\.com\/share\/([a-zA-Z0-9_-]+)/i) ||
                cleanUrl.match(/chat\.openai\.com\/share\/([a-zA-Z0-9_-]+)/i);

  if (!match) {
    return res.status(400).json({
      error: 'Invalid URL format. Please provide a valid ChatGPT link in the form: https://chatgpt.com/share/<share-id>'
    });
  }

  const shareId = match[1];
  const targetUrl = `https://chatgpt.com/share/${shareId}`;

  try {
    const response = await fetch(targetUrl, { method: 'GET', headers: BROWSER_HEADERS });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Failed to fetch ChatGPT conversation (HTTP status ${response.status}). The link may be private or deleted.`
      });
    }

    const html = await response.text();
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let streamPayloadRaw = null;
    let scriptMatch;

    while ((scriptMatch = scriptRegex.exec(html)) !== null) {
      const scriptContent = scriptMatch[1];
      if (scriptContent.includes('streamController.enqueue(')) {
        const firstEnqueueIdx = scriptContent.indexOf('streamController.enqueue(');
        if (firstEnqueueIdx !== -1) {
          const afterEnqueue = scriptContent.slice(firstEnqueueIdx + 'streamController.enqueue('.length);
          const lastSemi = afterEnqueue.lastIndexOf(');');
          const rawArg = lastSemi !== -1 ? afterEnqueue.slice(0, lastSemi).trim() : afterEnqueue.trim();
          try {
            const parsedStr = JSON.parse(rawArg);
            if (typeof parsedStr === 'string' && parsedStr.length > 1000) {
              streamPayloadRaw = parsedStr;
              break;
            }
          } catch (e) {}
        }
      }
    }

    if (!streamPayloadRaw) {
      return res.status(422).json({
        error: 'Unable to locate conversation stream in page payload. The link might require login or has expired.'
      });
    }

    const streamArray = JSON.parse(streamPayloadRaw);
    if (!Array.isArray(streamArray)) {
      return res.status(422).json({ error: 'Unexpected stream payload format.' });
    }

    const decodedData = decodeChatGPTTurboStream(streamArray);
    const result = extractChatGPTTurns(decodedData);

    if (!result || result.turns.length === 0) {
      return res.status(404).json({ error: 'No visible conversation turns found in this shared link.' });
    }

    result.share_url = targetUrl;
    result.share_id = shareId;

    return res.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error('[CHATGPT] Extraction error:', err);
    return res.status(500).json({
      error: `Server encountered an error while processing: ${err.message}`
    });
  }
});

/**
 * Health Check Endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ChatPorter — In-Memory ChatGPT Conversation Extractor',
    architecture: 'TurboStream In-Memory Deserialization Engine (Zero-Footprint)',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` ChatPorter (ChatGPT In-Memory Extractor)`);
  console.log(` Running live at: http://localhost:${PORT}`);
  console.log(` Health Check: http://localhost:${PORT}/api/health`);
  console.log(`=======================================================`);
});
