/** Minimal Discord-flavoured markdown → HTML */
function renderMarkdown(text: string): string {
  const lines = text.split('\n');
  const html: string[] = [];
  let inList = false;

  for (const line of lines) {
    if (line.match(/^-# /)) {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      html.push(`<span class="md-subtext">${escapeHtml(line.slice(3))}</span>`);
    } else if (line.match(/^# /)) {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      html.push(`<h1 class="md-h1">${inlineFormat(line.slice(2))}</h1>`);
    } else if (line.match(/^## /)) {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      html.push(`<h2 class="md-h2">${inlineFormat(line.slice(3))}</h2>`);
    } else if (line.match(/^ {4}- /)) {
      if (!inList) {
        html.push('<ul class="md-list">');
        inList = true;
      }
      html.push(`<li>${inlineFormat(line.slice(6))}</li>`);
    } else if (line.match(/^- /)) {
      if (!inList) {
        html.push('<ul class="md-list">');
        inList = true;
      }
      html.push(`<li>${inlineFormat(line.slice(2))}</li>`);
    } else if (line.trim() === '') {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      html.push('<br />');
    } else {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      html.push(`<p>${inlineFormat(line)}</p>`);
    }
  }

  if (inList) html.push('</ul>');
  return html.join('');
}

function inlineFormat(text: string): string {
  let s = escapeHtml(text);
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/<@&\d+>/g, '<span class="md-role-mention">@role</span>');
  s = s.replace(/<@!?\d+>/g, '<span class="md-user-mention">@user</span>');
  return s;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function Markdown({ content }: { content: string }) {
  return (
    <div
      className="discord-markdown"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  );
}
