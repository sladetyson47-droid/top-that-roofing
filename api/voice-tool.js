// Webhook for the AI phone answerer's create_lead tool.
// Supports ElevenLabs Agents (flat JSON body = tool args) and Vapi ({ message: { toolCallList } }).
// Auth: header X-Tool-Secret must match VOICE_TOOL_SECRET.
import { createLead } from '../lib/acculynx.js';

async function save(args) {
  if (args.caller_id && !/^\{\{/.test(args.caller_id)) {
    if (!args.phone) args.phone = args.caller_id;
    args.notes = [args.notes, `Caller ID: ${args.caller_id}`].filter(Boolean).join(' | ');
  }
  delete args.caller_id;
  if (args.address && typeof args.address === 'string') args.address = { street: args.address };
  if (args.street || args.city || args.zip) {
    args.address = { street: args.street, city: args.city, state: args.state, zip: args.zip };
    delete args.street; delete args.city; delete args.state; delete args.zip;
  }
  try {
    const r = await createLead(args, 'phone');
    return `Saved in AccuLynx (job ${r.jobId}). Tell the caller the owner will call them to set up the free estimate.`;
  } catch (e) {
    console.error('LEAD SAVE FAILED', JSON.stringify(args), e.message);
    return 'Could not save automatically. Tell the caller the owner will call them back shortly.';
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true });
  const secret = process.env.VOICE_TOOL_SECRET;
  if (!secret || (req.headers['x-tool-secret'] !== secret && req.headers['x-vapi-secret'] !== secret)) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const body = req.body || {};
  const calls = body.message?.toolCallList || body.message?.toolCalls;
  if (calls) {
    const results = [];
    for (const c of calls) {
      let args = c.function?.arguments ?? c.arguments ?? {};
      if (typeof args === 'string') { try { args = JSON.parse(args); } catch { args = {}; } }
      const caller = body.message?.call?.customer?.number;
      if (caller) args.caller_id = caller;
      results.push({ toolCallId: c.id, result: await save(args) });
    }
    return res.status(200).json({ results });
  }
  return res.status(200).json({ result: await save({ ...body }) });
}
