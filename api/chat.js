import { systemPrompt } from '../lib/knowledge.js';
import { createLead, LEAD_TOOL } from '../lib/acculynx.js';

const MODEL = process.env.CHAT_MODEL || 'claude-sonnet-5-5';

export async function runClaude(messages, channel, { maxTokens = 700 } = {}) {
  const convo = [...messages];
  let saved = false;
  for (let i = 0; i < 4; i++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system: systemPrompt(channel),
        tools: [LEAD_TOOL],
        messages: convo,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
    convo.push({ role: 'assistant', content: data.content });
    const uses = data.content.filter((b) => b.type === 'tool_use');
    if (!uses.length) {
      return { text: data.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim(), saved };
    }
    const results = [];
    for (const u of uses) {
      let out;
      try {
        const r = await createLead(u.input, channel);
        out = `Saved. AccuLynx job ${r.jobId}.`;
        saved = true;
      } catch (e) {
        console.error('LEAD SAVE FAILED', JSON.stringify(u.input), e.message);
        out = 'Could not save automatically. Tell them the owner will call them back shortly and ask them to also call (928) 536-4480 if urgent.';
      }
      results.push({ type: 'tool_result', tool_use_id: u.id, content: out });
    }
    convo.push({ role: 'user', content: results });
  }
  return { text: 'Thanks! The owner will reach out shortly — or call (928) 536-4480.', saved };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'messages required' });
    const clean = messages.slice(-30).map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').slice(0, 2000),
    }));
    const { text, saved } = await runClaude(clean, 'chat');
    res.status(200).json({ reply: text, leadSaved: saved });
  } catch (e) {
    console.error(e);
    res.status(500).json({ reply: "Sorry — I'm having trouble right now. Please call (928) 536-4480." });
  }
}
