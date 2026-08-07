import { describe, it, expect } from 'vitest';

/* ========== PURE FUNCTIONS (redefined inline for test isolation) ========== */
function escChar(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');
}
function inline(s) {
  return s.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function renderMarkdown(text) {
  var html = escChar(text);
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  html = html.replace(/((?:^[ \t]*\|[^\n]*\|[ \t]*\n)+(?:^[ \t]*\|[^\n]*\|[ \t]*$)?)/gm, function(block) {
    var rows = block.trim().split('\n').filter(function(l) { return l.includes('|'); });
    var out = '<table class="chat-table">';
    for (var i = 0; i < rows.length; i++) {
      var cells = rows[i].trim().replace(/^\||\|$/g, '').split('|').map(function(c) { return c.trim(); });
      var isSep = i === 1 && cells.every(function(c) { return /^:?-+:?$/.test(c); });
      if (isSep) continue;
      out += '<tr>';
      for (var j = 0; j < cells.length; j++) {
        var tag = i === 0 ? 'th' : 'td';
        out += '<' + tag + '>' + inline(cells[j]) + '</' + tag + '>';
      }
      out += '</tr>';
    }
    out += '</table>';
    return out;
  });
  html = html.replace(/(?:^|\n)([ \t]*- [^\n]+(?:\n[ \t]*- [^\n]+)*)/gm, function(m, group) {
    var items = group.split('\n').map(function(l) { return l.replace(/^\s*-\s+/, ''); });
    return '\n<ul>' + items.map(function(it) { return '<li>' + inline(it) + '</li>'; }).join('') + '</ul>';
  });
  html = html.replace(/(?:^|\n)([ \t]*\d+\. [^\n]+(?:\n[ \t]*\d+\. [^\n]+)*)/gm, function(m, group) {
    var items = group.split('\n').map(function(l) { return l.replace(/^\s*\d+\.\s+/, ''); });
    return '\n<ol>' + items.map(function(it) { return '<li>' + inline(it) + '</li>'; }).join('') + '</ol>';
  });
  html = html.replace(/`([^`]+)`/g, function(_, code) { return '<code>' + code + '</code>'; });
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

/* ========== TESTS ========== */
describe('renderMarkdown', () => {
  it('escapa HTML', () => {
    expect(renderMarkdown('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('rendereiza negrita y cursiva', () => {
    expect(renderMarkdown('**hola** y *cursiva*')).toBe('<strong>hola</strong> y <em>cursiva</em>');
  });

  it('rendereiza codigo inline', () => {
    expect(renderMarkdown('usa `code` aqui')).toBe('usa <code>code</code> aqui');
  });

  it('rendereiza code block', () => {
    const out = renderMarkdown('```js\nvar x=1;\n```');
    expect(out).toContain('<pre><code>');
    expect(out).toContain('var x=1;');
  });

  it('rendereiza una tabla markdown', () => {
    const md = '| Producto | Stock |\n|----------|-------|\n| Arroz | 5 |\n| Harina | 10 |';
    const out = renderMarkdown(md);
    expect(out).toContain('<table class="chat-table">');
    expect(out).toContain('<th>Producto</th>');
    expect(out).toContain('<th>Stock</th>');
    expect(out).toContain('<td>Arroz</td>');
    expect(out).toContain('<td>10</td>');
    expect((out.match(/<tr>/g) || []).length).toBe(3);
  });

  it('excluye la fila separadora de la tabla', () => {
    const md = '| A |\n|---|\n| 1 |';
    const out = renderMarkdown(md);
    expect(out).not.toContain('<td>---</td>');
    expect(out).toContain('<th>A</th>');
    expect(out).toContain('<td>1</td>');
  });

  it('rendereiza lista desordenada', () => {
    const md = '- Uno\n- Dos\n- Tres';
    const out = renderMarkdown(md);
    expect(out).toContain('<ul>');
    expect(out).toContain('<li>Uno</li>');
    expect(out).toContain('<li>Dos</li>');
    expect(out).toContain('<li>Tres</li>');
  });

  it('rendereiza lista ordenada', () => {
    const md = '1. Primero\n2. Segundo';
    const out = renderMarkdown(md);
    expect(out).toContain('<ol>');
    expect(out).toContain('<li>Primero</li>');
    expect(out).toContain('<li>Segundo</li>');
  });

  it('convierte saltos de linea a <br>', () => {
    expect(renderMarkdown('linea1\nlinea2')).toBe('linea1<br>linea2');
  });
});