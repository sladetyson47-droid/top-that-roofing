(function () {
  const css = `
#tt-chat-btn{position:fixed;right:18px;bottom:18px;z-index:9999;width:60px;height:60px;border-radius:50%;border:0;background:#a64316;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.3);cursor:pointer;display:grid;place-items:center}
#tt-chat-btn svg{width:28px;height:28px}
#tt-chat{position:fixed;right:18px;bottom:88px;z-index:9999;width:360px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 120px);background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.35);display:none;flex-direction:column;overflow:hidden;font-family:Inter,system-ui,sans-serif}
#tt-chat.open{display:flex}
#tt-chat header{position:static;background:#102132;color:#fff;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;border:0;backdrop-filter:none}
#tt-chat header b{font-family:"Barlow Condensed",Inter,sans-serif;text-transform:uppercase;font-size:1.2rem;letter-spacing:.02em}
#tt-chat header small{display:block;color:#cbd5e1;font-size:.75rem}
#tt-chat header button{background:none;border:0;color:#fff;font-size:1.4rem;cursor:pointer;line-height:1}
#tt-msgs{flex:1;overflow-y:auto;padding:14px;background:#f6f7fa;display:flex;flex-direction:column;gap:10px}
.tt-m{max-width:85%;padding:10px 13px;border-radius:14px;font-size:.93rem;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}
.tt-a{background:#fff;border:1px solid #e2e8f0;color:#0f172a;align-self:flex-start;border-bottom-left-radius:4px}
.tt-u{background:#102132;color:#fff;align-self:flex-end;border-bottom-right-radius:4px}
.tt-typing{opacity:.6;font-style:italic}
#tt-form{display:flex;gap:8px;padding:10px;border-top:1px solid #e2e8f0;background:#fff}
#tt-form input{flex:1;padding:11px 13px;border:1px solid #e2e8f0;border-radius:999px;font:inherit;font-size:16px}
#tt-form button{background:#a64316;color:#fff;border:0;border-radius:999px;padding:0 16px;font-weight:600;cursor:pointer}
@media(max-width:480px){#tt-chat{right:8px;left:8px;width:auto;bottom:84px;height:calc(100vh - 110px)}}
`;
  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);

  const btn = document.createElement('button');
  btn.id = 'tt-chat-btn'; btn.setAttribute('aria-label', 'Chat with Top That Roofing');
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  const box = document.createElement('div');
  box.id = 'tt-chat';
  box.innerHTML = '<header><div><b>Top That Roofing</b><small>Ask anything about your roof</small></div><button aria-label="Close">×</button></header><div id="tt-msgs"></div><form id="tt-form"><input placeholder="Type your question…" autocomplete="off"><button>Send</button></form>';
  document.body.append(btn, box);

  const msgs = box.querySelector('#tt-msgs');
  const form = box.querySelector('#tt-form');
  const input = form.querySelector('input');
  const history = [];
  const greeting = "Hi! I can answer roofing questions or set you up with a free estimate. What's going on with your roof?";

  function add(text, who) {
    const d = document.createElement('div');
    d.className = 'tt-m ' + (who === 'user' ? 'tt-u' : 'tt-a');
    d.textContent = text; msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d;
  }
  let greeted = false;
  function toggle() {
    box.classList.toggle('open');
    if (!greeted) { add(greeting, 'assistant'); greeted = true; }
    if (box.classList.contains('open')) input.focus();
  }
  btn.onclick = toggle;
  box.querySelector('header button').onclick = toggle;

  let busy = false;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const text = input.value.trim(); if (!text || busy) return;
    busy = true; input.value = '';
    add(text, 'user'); history.push({ role: 'user', content: text });
    const t = add('Typing…', 'assistant'); t.classList.add('tt-typing');
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history }) });
      const d = await r.json();
      t.remove(); add(d.reply, 'assistant');
      history.push({ role: 'assistant', content: d.reply + (d.leadSaved ? '\n(Lead already saved in AccuLynx — do not save again.)' : '') });
    } catch {
      t.remove(); add('Sorry — something went wrong. Please call (928) 536-4480.', 'assistant');
      history.pop();
    }
    busy = false;
  };
})();
