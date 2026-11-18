/* Kvittel renderer: draws the kvittel on a canvas and turns it into an A5 PDF.
   Used by the website form and for the printable blank kvittel. Needs vendor/jspdf.umd.min.js. */
(function () {
  var W = 1240, H = 1754; // A5 at ~213 dpi
  var C = { paper: '#fbf5ea', brown: '#6b3a17', ink: '#2a1b10', muted: '#7a6450', copper: '#c48a52', line: '#d9c3a5' };
  var DISPLAY = '"Frank Ruhl Libre", "David Libre", "Times New Roman", serif';
  var BODY = '"Assistant", "Arial Hebrew", Arial, sans-serif';
  var SERVICES = [
    { id: 'kvittel', he: 'קריאת הקוויטל' },
    { id: 'tehillim', he: 'אמירת תהלים' },
    { id: 'candle', he: 'הדלקת נר' },
    { id: 'mishnayos', he: 'לימוד משניות' }
  ];

  var logoPromise = null;
  function loadLogo(src) {
    if (!logoPromise) {
      logoPromise = new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () { resolve(img); };
        img.onerror = function () { resolve(null); };
        img.src = src || 'images/logo-kvittel.png';
      });
    }
    return logoPromise;
  }

  function loadFonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var faces = ['900 80px ' + DISPLAY, '700 40px ' + DISPLAY, '500 34px ' + DISPLAY, '400 30px ' + BODY, '700 30px ' + BODY];
    return Promise.all(faces.map(function (f) { return document.fonts.load(f, 'אבג').catch(function () {}); }));
  }

  function font(ctx, weight, size, fam) { ctx.font = weight + ' ' + size + 'px ' + (fam || DISPLAY); }

  // Wrap text to lines no wider than maxW (works for Hebrew/Yiddish and English).
  function wrap(ctx, text, maxW) {
    var out = [];
    String(text || '').split(/\n+/).forEach(function (para) {
      var words = para.trim().split(/\s+/).filter(Boolean), line = '';
      words.forEach(function (w) {
        var test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w; } else { line = test; }
      });
      if (line) out.push(line);
    });
    return out;
  }

  function dashed(ctx, x1, x2, y) {
    ctx.save(); ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke(); ctx.restore();
  }

  function ornament(ctx, y) {
    ctx.save(); ctx.strokeStyle = C.copper; ctx.fillStyle = C.copper; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W / 2 - 230, y); ctx.lineTo(W / 2 - 22, y); ctx.moveTo(W / 2 + 22, y); ctx.lineTo(W / 2 + 230, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W / 2, y - 11); ctx.lineTo(W / 2 + 11, y); ctx.lineTo(W / 2, y + 11); ctx.lineTo(W / 2 - 11, y); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function label(ctx, text, y) {
    font(ctx, 700, 30, BODY); ctx.fillStyle = C.copper; ctx.textAlign = 'center';
    ctx.fillText(text, W / 2, y);
  }

  function fmtDate(d) {
    var dd = ('0' + d.getDate()).slice(-2), mm = ('0' + (d.getMonth() + 1)).slice(-2);
    return dd + '.' + mm + '.' + d.getFullYear();
  }

  // data: {name, gender:'ben'|'bas', mother, more, req, from, services:[ids]} — empty data draws a blank kvittel to fill in by hand.
  // Style: arch + logo, big "קוויטל" on top, the sender's name at the bottom above the gabbai line.
  function draw(canvas, data, logo) {
    data = data || {};
    var blank = !data.name;
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    ctx.direction = 'rtl'; ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = C.copper; ctx.lineWidth = 4; ctx.strokeRect(38, 38, W - 76, H - 76);
    ctx.strokeStyle = C.brown; ctx.lineWidth = 1.5; ctx.strokeRect(54, 54, W - 108, H - 108);

    var ax1 = 110, ax2 = W - 110, r = (ax2 - ax1) / 2, cy = 110 + r, bottom = 1610;
    ctx.save(); ctx.strokeStyle = C.copper; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(ax1, bottom); ctx.lineTo(ax1, cy); ctx.arc(W / 2, cy, r, Math.PI, 0); ctx.lineTo(ax2, bottom); ctx.stroke(); ctx.restore();

    if (logo) { var lh = 220, lw = lh * logo.width / logo.height; ctx.drawImage(logo, (W - lw) / 2, 125, lw, lh); }

    ctx.textAlign = 'center'; ctx.fillStyle = C.brown; font(ctx, 900, 96);
    ctx.fillText('קוויטל', W / 2, 445);
    ctx.fillStyle = C.muted; font(ctx, 500, 32);
    ctx.fillText('לציון התנא האלוקי רבי שמעון בר יוחאי זי״ע · מירון', W / 2, 497);
    ornament(ctx, 532);

    var x1 = ax1 + 60, x2 = ax2 - 60, maxW = x2 - x1, y = 532;

    if (blank) {
      // blank kvittel: just the header, arch and gabbai line, room to write
    } else {
      var who = data.name.trim() + (data.mother ? ' ' + (data.gender === 'bas' ? 'בת' : 'בן') + ' ' + data.mother.trim() : '');
      var more = String(data.more || '').split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
      var req = String(data.req || '').trim();
      var sel = data.services || [];
      var svc = SERVICES.filter(function (s) { return sel.indexOf(s.id) >= 0; }).map(function (s) { return s.he; }).join(' · ');
      // shrink everything together until it fits under the arch
      var k = 1, lines, layout;
      for (; k > 0.5; k -= 0.05) {
        var sMain = Math.round(64 * k), sMore = Math.round(46 * k), sReq = Math.round(42 * k), gap = Math.round(60 * k);
        layout = { main: [], more: [], req: [] };
        font(ctx, 900, sMain); layout.main = wrap(ctx, who, maxW);
        font(ctx, 700, sMore); more.forEach(function (n) { layout.more = layout.more.concat(wrap(ctx, n, maxW)); });
        font(ctx, 700, sReq); layout.req = req ? wrap(ctx, req, maxW) : [];
        var hgt = 110 + layout.main.length * sMain * 1.25 + (layout.more.length ? gap + layout.more.length * sMore * 1.3 : 0) +
          (layout.req.length ? gap + layout.req.length * sReq * 1.35 : 0) + (svc ? gap + 40 : 0);
        if (532 + hgt < 1590) break;
      }
      y += Math.round(30 * k);
      ctx.fillStyle = C.ink;
      font(ctx, 900, sMain); layout.main.forEach(function (l) { y += Math.round(sMain * 1.25); ctx.fillText(l, W / 2, y); });
      if (layout.more.length) { y += gap - Math.round(sMore * 0.3); font(ctx, 700, sMore); layout.more.forEach(function (l) { y += Math.round(sMore * 1.3); ctx.fillText(l, W / 2, y); }); }
      if (layout.req.length) { y += gap - Math.round(sReq * 0.35); ctx.fillStyle = C.brown; font(ctx, 700, sReq); layout.req.forEach(function (l) { y += Math.round(sReq * 1.35); ctx.fillText(l, W / 2, y); }); }
      if (svc) { y += gap; ornament(ctx, y - 20); font(ctx, 600, Math.round(34 * Math.max(k, 0.8)), BODY); ctx.fillStyle = C.muted; ctx.fillText(svc, W / 2, y + 30); }
    }

    // sender, then the gabbai line
    var from = blank ? '' : String(data.from || '').trim();
    if (from) {
      var fs = 34; font(ctx, 700, fs, BODY); while (ctx.measureText(from).width > 900 && fs > 22) { fs -= 2; font(ctx, 700, fs, BODY); }
      ctx.fillStyle = C.brown; ctx.direction = /[֐-׿]/.test(from) ? 'rtl' : 'ltr'; ctx.fillText(from, W / 2, 1645); ctx.direction = 'rtl';
    }
    font(ctx, 400, 25, BODY); ctx.fillStyle = C.muted;
    ctx.fillText('רבי ישעי\'לע ביי רבי שמעון · הגבאי מרדכי שמעון חיימאוויטש · WhatsApp ⁦+1 929-380-1124⁩', W / 2, 1680);
    return canvas;
  }

  function render(data, opts) {
    opts = opts || {};
    return Promise.all([loadFonts(), loadLogo(opts.logo)]).then(function (r) {
      var canvas = document.createElement('canvas');
      return draw(canvas, data, r[1]);
    });
  }

  function toPdf(canvas) {
    var JsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!JsPDF) throw new Error('PDF library did not load');
    var doc = new JsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait', compress: true });
    doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 148, 210);
    doc.setProperties({ title: 'קוויטל', subject: 'Kvittel for the tziyun of Rabbi Shimon bar Yochai, Meron', creator: 'rebshimon.github.io' });
    return doc.output('blob');
  }

  // Some browsers drop non-Latin download names, so Hebrew names fall back to the date and time.
  function fileName(data) {
    var n = (data && data.name ? data.name.trim() : '').replace(/[^A-Za-z0-9 _-]+/g, '').trim().replace(/\s+/g, '-');
    if (!n) {
      var d = new Date(), p = function (x) { return ('0' + x).slice(-2); };
      n = d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
    }
    return 'kvittel-' + n + '.pdf';
  }

  window.Kvittel = { render: render, toPdf: toPdf, fileName: fileName, draw: draw };
})();
