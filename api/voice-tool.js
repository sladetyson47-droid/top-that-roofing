// Webhook for the AI phone answerer (Vapi "tool-calls" server message).
// Vapi sends: { message: { type: 'tool-calls', toolCallList: [{ id, function: { name, arguments } }] } }
// Auth: Vapi tool "server.secret" is sent as X-Vapi-Secret; must match VOICE_TOOL_SECRET.
import { createLead } from '../lib/acculynx.js';
import { systemPrompt } from '../lib/knowledge.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Lets the setup script pull the current phone prompt.
    if (req.query.prompt === '1' && req.headers['x-vapi-secret'] === process.env.VOICE_TOOL_SECRET) {
      return res.status(200).send(systemPrompt('phone'));
    }
    return res.status(200).json({ ok: true });
  }
  if (process.env.VOICE_TOOL_SECRET && req.headers['x-vapi-secret'] !== process.env.VOICE_TOOL_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const msg = (req.body && req.body.message) || {};
  const calls = msg.toolCallList || msg.toolCalls || [];
  const caller = msg.call?.customer?.number;
  const results = [];
  for (const c of calls) {
    const name = c.function?.name || c.name;
    let args = c.function?.arguments ?? c.arguments ?? {};
    if (typeof args === 'string') { try { args = JSON.parse(args); } catch { args = {}; } }
    if (name !== 'create_lead') { results.push({ toolCallId: c.id, result: 'Unknown tool' }); continue; }
    if (!args.phone && caller) args.phone = caller;
    if (caller) args.notes = [args.notes, `Caller ID: ${caller}`].filter(Boolean).join(' | ');
    try {
      const r = await createLead(args, 'phone');
      results.push({ toolCallId: c.id, result: `Saved in AccuLynx (job ${r.jobId}).` });
    } catch (e) {
      console.error('LEAD SAVE FAILED', JSON.stringify(args), e.message);
      results.push({ toolCallId: c.id, result: 'Could not save automatically; tell the caller the owner will call them back shortly.' });
    }
  }
  res.status(200).json({ results });
}
