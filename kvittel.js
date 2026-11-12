/* Kvittel (פדיון נפש) renderer: draws the kvittel on a canvas and turns it into an A5 PDF.
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
        img.src = src || 'images/logo.png';
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

  // data: {name, gender:'ben'|'bas', mother, more, req, services:[ids]} — empty data draws a blank kvittel to fill in by hand.
  function draw(canvas, data, logo) {
    data = data || {};
    var blank = !data.name;
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    ctx.direction = 'rtl'; ctx.textBaseline = 'alphabetic';

    // paper + frame
    ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = C.copper; ctx.lineWidth = 4; ctx.strokeRect(38, 38, W - 76, H - 76);
    ctx.strokeStyle = C.brown; ctx.lineWidth = 1.5; ctx.strokeRect(54, 54, W - 108, H - 108);

    // arch, echoing the logo and the sponsor sign
    var ax1 = 130, ax2 = W - 130, r = (ax2 - ax1) / 2, cy = 120 + r, bottom = 1530;
    ctx.save(); ctx.strokeStyle = C.copper; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(ax1, bottom); ctx.lineTo(ax1, cy); ctx.arc(W / 2, cy, r, Math.PI, 0); ctx.lineTo(ax2, bottom); ctx.stroke(); ctx.restore();

    // logo
    if (logo) {
      var lh = 330, lw = lh * logo.width / logo.height;
      ctx.drawImage(logo, (W - lw) / 2, 150, lw, lh);
    }

    var y = 590;
    ctx.textAlign = 'center'; ctx.fillStyle = C.brown; font(ctx, 900, 92);
    ctx.fillText('פדיון נפש', W / 2, y);
    y += 58; ctx.fillStyle = C.muted; font(ctx, 500, 34);
    ctx.fillText('לציון התנא האלוקי רבי שמעון בר יוחאי זי״ע · מירון', W / 2, y);
    y += 46; ornament(ctx, y);

    var x1 = ax1 + 70, x2 = ax2 - 70, maxW = x2 - x1;

    // main name
    y += 108;
    if (blank) {
      dashed(ctx, x1, x2, y);
      font(ctx, 400, 26, BODY); ctx.fillStyle = C.muted; ctx.fillText('שם  ·  בן / בת  ·  שם האם', W / 2, y + 40);
      y += 40;
    } else {
      var who = data.name.trim() + (data.mother ? ' ' + (data.gender === 'bas' ? 'בת' : 'בן') + ' ' + data.mother.trim() : '');
      var size = 72; font(ctx, 900, size);
      while (ctx.measureText(who).width > maxW && size > 40) { size -= 4; font(ctx, 900, size); }
      ctx.fillStyle = C.ink; ctx.fillText(who, W / 2, y);
    }

    // more names
    var more = blank ? [] : String(data.more || '').split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (blank || more.length) {
      y += 78; label(ctx, 'ועוד', y);
      if (blank) {
        for (var i = 0; i < 2; i++) { y += 62; dashed(ctx, x1, x2, y); }
      } else {
        font(ctx, 700, 44); ctx.fillStyle = C.ink;
        var mLines = [];
        more.forEach(function (n) { mLines = mLines.concat(wrap(ctx, n, maxW)); });
        mLines.slice(0, 6).forEach(function (l) { y += 58; ctx.fillText(l, W / 2, y); });
      }
    }

    // request
    var req = blank ? '' : String(data.req || '').trim();
    if (blank || req) {
      y += 80; label(ctx, 'בקשה', y);
      if (blank) {
        for (var j = 0; j < 3; j++) { y += 62; dashed(ctx, x1, x2, y); }
      } else {
        font(ctx, 500, 44); ctx.fillStyle = C.ink;
        var rLines = wrap(ctx, req, maxW), rSize = 44;
        while (rLines.length > 5 && rSize > 30) { rSize -= 4; font(ctx, 500, rSize); rLines = wrap(ctx, req, maxW); }
        rLines.slice(0, 7).forEach(function (l) { y += rSize + 16; ctx.fillText(l, W / 2, y); });
      }
    }

    // services: 2x2 grid of check boxes, kept above the arch's base
    var sy = Math.min(Math.max(y + 90, 1290), 1420);
    var sel = data.services || [];
    font(ctx, 600, 34, BODY);
    var colX = [W / 2 + 250, W / 2 - 110];
    SERVICES.forEach(function (s, k) {
      var cx = colX[k % 2], yy = sy + Math.floor(k / 2) * 66;
      var box = 30, bx = cx - box; // box on the right of the label (RTL)
      ctx.strokeStyle = C.brown; ctx.lineWidth = 2.5; ctx.strokeRect(bx, yy - box + 4, box, box);
      if (!blank && sel.indexOf(s.id) >= 0) {
        ctx.strokeStyle = C.brown; ctx.lineWidth = 5; ctx.beginPath();
        ctx.moveTo(bx + 6, yy - 10); ctx.lineTo(bx + 13, yy - 2); ctx.lineTo(bx + 26, yy - 22); ctx.stroke();
      }
      ctx.fillStyle = C.ink; ctx.textAlign = 'right'; ctx.fillText(s.he, bx - 14, yy);
    });
    ctx.textAlign = 'center';

    // footer under the arch
    ctx.fillStyle = C.brown; font(ctx, 700, 40);
    ctx.fillText('יאכלו ענוים וישבעו', W / 2, 1600);
    font(ctx, 400, 25, BODY); ctx.fillStyle = C.muted;
    ctx.fillText('רבי ישעי\'לע ביי רבי שמעון · הגבאי מרדכי שמעון חיימאוויטש · WhatsApp ‎+1 929-380-1124', W / 2, 1650);
    if (!blank) {
      ctx.fillText('rebshimon.github.io · ' + fmtDate(new Date()), W / 2, 1688);
    } else {
      ctx.fillText('rebshimon.github.io', W / 2, 1688);
    }
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
    doc.setProperties({ title: 'קוויטל · פדיון נפש', subject: 'Kvittel for the tziyun of Rabbi Shimon bar Yochai, Meron', creator: 'rebshimon.github.io' });
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
