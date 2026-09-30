// Creates a contact + job (lands in the "Lead" milestone, Unassigned) in Top That's AccuLynx.
// Env: ACCULYNX_API_KEY (required), ACCULYNX_LEAD_SOURCE_ID (optional)
const BASE = 'https://api.acculynx.com/api/v2';

async function ax(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: {
      Authorization: `Bearer ${process.env.ACCULYNX_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let body; try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!res.ok) throw new Error(`AccuLynx ${opts.method || 'GET'} ${path} ${res.status}: ${text.slice(0, 400)}`);
  return { body, headers: res.headers };
}

let customerTypeId;
async function getCustomerTypeId() {
  if (customerTypeId) return customerTypeId;
  const { body } = await ax('/contacts/types');
  const list = body.items || body.data || body;
  const t = list.find((x) => /customer/i.test(x.name || x.displayName || '')) || list[0];
  customerTypeId = t.id;
  return customerTypeId;
}

function idFrom(body, headers) {
  if (body && (body.id || body.contactId || body.jobId)) return body.id || body.contactId || body.jobId;
  const loc = headers.get('location') || '';
  return loc.split('/').filter(Boolean).pop();
}

function splitName(full = '') {
  const parts = full.trim().split(/\s+/);
  return { firstName: parts[0] || 'Unknown', lastName: parts.slice(1).join(' ') || '(from AI)' };
}

function parseAddress(a = {}) {
  if (!a.street && !a.city) return undefined;
  return {
    street1: a.street || '',
    city: a.city || '',
    state: { abbreviation: (a.state || 'AZ').toUpperCase() },
    zipCode: a.zip || '',
    country: { abbreviation: 'US' },
  };
}

export async function createLead(lead, channel) {
  if (!process.env.ACCULYNX_API_KEY) throw new Error('ACCULYNX_API_KEY not set');
  const typeId = await getCustomerTypeId();
  const { firstName, lastName } = splitName(lead.name);
  const address = parseAddress(lead.address);
  const phone = (lead.phone || '').replace(/[^\d]/g, '').slice(-10);

  const full = {
    contactTypeIds: [typeId],
    firstName, lastName,
    phoneNumbers: phone ? [{ number: phone, type: 'Mobile', primary: true }] : [],
    emailAddresses: lead.email ? [{ address: lead.email, type: 'Personal', primary: true }] : [],
    ...(address ? { mailingAddress: address } : {}),
  };
  let c;
  try { c = await ax('/contacts', { method: 'POST', body: JSON.stringify(full) }); }
  catch (e) {
    // Fall back to the minimum AccuLynx accepts; details still go in job notes.
    console.error('full contact failed, retrying minimal', e.message);
    c = await ax('/contacts', { method: 'POST', body: JSON.stringify({ contactTypeIds: [typeId], firstName, lastName }) });
  }
  const contactId = idFrom(c.body, c.headers);

  const notes = [
    `[AI ${channel === 'phone' ? 'phone answerer' : 'website chat'}]`,
    `Needs: ${lead.needs || '-'}`,
    lead.roofType ? `Roof: ${lead.roofType}` : '',
    `Phone: ${lead.phone || '-'}`,
    lead.email ? `Email: ${lead.email}` : '',
    lead.address ? `Address: ${[lead.address.street, lead.address.city, lead.address.state, lead.address.zip].filter(Boolean).join(', ')}` : '',
    lead.notes ? `Notes: ${lead.notes}` : '',
  ].filter(Boolean).join('\n').slice(0, 1000);

  const job = {
    contact: { id: contactId },
    priority: lead.urgent ? 'Urgent' : 'Normal',
    notes,
    ...(address ? { locationAddress: address } : {}),
    ...(process.env.ACCULYNX_LEAD_SOURCE_ID ? { leadSource: { id: process.env.ACCULYNX_LEAD_SOURCE_ID } } : {}),
  };
  let j;
  try { j = await ax('/jobs', { method: 'POST', body: JSON.stringify(job) }); }
  catch (e) {
    console.error('job w/ address failed, retrying without', e.message);
    delete job.locationAddress;
    j = await ax('/jobs', { method: 'POST', body: JSON.stringify(job) });
  }
  return { contactId, jobId: idFrom(j.body, j.headers) };
}

// Tool schema shared by chat + phone.
export const LEAD_TOOL = {
  name: 'create_lead',
  description: 'Save a new lead in Top That Roofing\'s AccuLynx CRM. Call once per person, after confirming details.',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Full name' },
      phone: { type: 'string' },
      email: { type: 'string' },
      address: {
        type: 'object',
        properties: { street: { type: 'string' }, city: { type: 'string' }, state: { type: 'string' }, zip: { type: 'string' } },
      },
      roofType: { type: 'string', description: 'shingle, metal, flat/TPO, tile, unknown' },
      needs: { type: 'string', description: 'What they need, in a sentence' },
      urgent: { type: 'boolean', description: 'Active leak or storm damage' },
      notes: { type: 'string', description: 'Anything else useful: best time to call, insurance claim, out of area, etc.' },
    },
    required: ['name', 'phone', 'needs'],
  },
};
