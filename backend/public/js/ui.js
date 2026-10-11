const UI = (() => {
  function toast(msg, isError = false) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.toggle('error', isError);
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 3200);
  }

  const fmtMoney = (n) => 'Q ' + (Number(n) || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtNum = (n) => (Number(n) || 0).toLocaleString('es-GT');
  const fmtPct = (n) => (Number(n) || 0).toLocaleString('es-GT', { maximumFractionDigits: 1 }) + '%';

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c === null || c === undefined) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function todayISO() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }

  async function handle(promise, okMsg) {
    try {
      const data = await promise;
      if (okMsg) toast(okMsg);
      return data;
    } catch (e) {
      toast(e.message || 'Ocurrió un error', true);
      throw e;
    }
  }

  return { toast, fmtMoney, fmtNum, fmtPct, el, todayISO, handle };
})();
