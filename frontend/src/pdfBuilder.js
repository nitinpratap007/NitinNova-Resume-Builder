import { jsPDF } from 'jspdf'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Toast } from '@capacitor/toast'
import { buildResumeLayout, PDF_SCALE } from './resumeLayout'
import { normalizeResumeData, safePdfFilename } from './resumeNormalize'

// A4 page: 210mm × 297mm = 595.28 × 841.89 pt
const PAGE_W = 595.28
const PAGE_H = 841.89

// ---- color helpers ---------------------------------------------------------
function hexToRgb(hex) {
  const h = (hex || '#000000').replace('#', '')
  const f = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const n = parseInt(f.slice(0, 6) || '000000', 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}
// readable text color when drawing on top of the accent color
function onAccent(hex) { return luminance(hex) > 0.55 ? [15, 23, 42] : [255, 255, 255] }

const FONT_MAP = { 'Helvetica': 'helvetica', 'Times-Roman': 'times', 'Times': 'times', 'Courier': 'courier' }

const TEXT = [31, 41, 55]     // #1f2937
const HEAD = [15, 23, 42]     // #0f172a
const MUTED = [71, 85, 105]   // #475569
const RULE = [203, 213, 225]  // #cbd5e1

// ---- photo masking (circle / rounded / square) -----------------------------
function shapePhoto(dataUrl, shape, size = 256) {
  return new Promise(resolve => {
    if (!dataUrl) return resolve('')
    if (shape === 'square') return resolve(dataUrl)
    const img = new Image()
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width = size; c.height = size
        const ctx = c.getContext('2d')
        ctx.save()
        if (shape === 'circle') {
          ctx.beginPath()
          ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
          ctx.clip()
        } else {
          const r = size * 0.18
          ctx.beginPath()
          ctx.moveTo(r, 0)
          ctx.arcTo(size, 0, size, size, r)
          ctx.arcTo(size, size, 0, size, r)
          ctx.arcTo(0, size, 0, 0, r)
          ctx.arcTo(0, 0, size, 0, r)
          ctx.closePath()
          ctx.clip()
        }
        // center-crop to square
        const s = Math.min(img.width, img.height)
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size)
        ctx.restore()
        resolve(c.toDataURL('image/png'))
      } catch { resolve(dataUrl) }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

// ---- rich text: word-wrap mixed bold/normal parts with hanging indent ------
function layoutRich(doc, font, parts, width) {
  const lines = []
  let cur = { chunks: [] }
  let cx = 0
  for (const part of parts) {
    if (!part.text) continue
    doc.setFont(font, part.bold ? 'bold' : 'normal')
    const words = part.text.split(/(\s+)/).filter(w => w !== '')
    for (const w of words) {
      const ww = doc.getTextWidth(w)
      if (cx + ww > width && cur.chunks.length > 0) {
        lines.push(cur)
        cur = { chunks: [] }
        cx = 0
      }
      cur.chunks.push({ text: w, bold: !!part.bold, color: part.color })
      cx += ww
    }
  }
  if (cur.chunks.length) lines.push(cur)
  if (!lines.length) lines.push({ chunks: [] })
  return lines
}

// =============================================================================
// Build the resume PDF — real selectable text, ATS-parseable, multi-page safe.
// =============================================================================
export async function buildResumePdf(raw) {
  // Normalize at the export boundary so corrupted/duplicated legacy data can
  // never leak duplicated sections/items into the PDF.
  const p = normalizeResumeData(raw)
  const L = buildResumeLayout(p)

  // Wait for webfonts to finish loading so text metrics match the preview.
  try { if (document && document.fonts && document.fonts.ready) await document.fonts.ready } catch {}

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })

  const pageW = PAGE_W, pageH = PAGE_H
  const margin = Math.max(L.margins * PDF_SCALE, 18)
  const contentW = pageW - margin * 2
  const x = margin

  const body = L.sz.bodySize * PDF_SCALE
  const head = L.sz.headingSize * PDF_SCALE
  const nameSz = L.sz.nameSize * PDF_SCALE
  const lineH = body * 1.5
  const font = FONT_MAP[L.fc.pdfFont] || 'helvetica'

  let y = margin

  const ensure = (h) => {
    if (y + h > pageH - margin) { doc.addPage(); y = margin }
  }

  doc.setFont(font, 'normal')

  function drawLine(chunks, startX, baselineX, lh) {
    // chunks: [{text,bold,color}] drawn inline starting at startX on current y
    let cx = startX
    for (const ch of chunks) {
      doc.setFont(font, ch.bold ? 'bold' : 'normal')
      doc.setFontSize(body)
      if (ch.color) doc.setTextColor(...ch.color); else doc.setTextColor(...TEXT)
      doc.text(ch.text, cx, y + body * 0.8)
      cx += doc.getTextWidth(ch.text)
    }
    y += lh
  }

  function drawRich(parts, indent = 12, lh = lineH) {
    doc.setFont(font, 'normal')
    doc.setFontSize(body)
    const lines = layoutRich(doc, font, parts, contentW - indent)
    lines.forEach((ln, i) => {
      ensure(lh)
      const startX = i === 0 ? x : x + indent
      drawLine(ln.chunks, startX, x, lh)
    })
    if (!lines.length) { ensure(lh); y += lh }
  }

  function drawWrappedText(text, opts = {}) {
    const lh = opts.lh || lineH
    const color = opts.color || TEXT
    const size = opts.size || body
    const paras = String(text).split('\n')
    paras.forEach(para => {
      if (para.trim() === '') { ensure(lh); y += lh * 0.6; return }
      doc.setFont(font, opts.bold ? 'bold' : 'normal')
      doc.setFontSize(size)
      doc.setTextColor(...color)
      const words = para.split(/(\s+)/).filter(w => w !== '')
      // NOTE: after flush() the accumulated string MUST NOT be re-assigned back
      // into `line`. Doing so reintroduces the whole paragraph into the next
      // physical line, so every following word pushes the (now too-wide) line
      // again — the "text printed many times, each copy longer" corruption.
      let line = ''
      const flush = () => {
        ensure(lh)
        doc.text(line, x + (opts.indent || 0), y + size * 0.8)
        y += lh
        line = ''
      }
      for (const w of words) {
        const test = line + w
        if (line.trim() && doc.getTextWidth(test.trim()) > contentW - (opts.indent || 0)) {
          flush()
          line = w // restart the physical line with the word that overflowed
        } else {
          line = test
        }
      }
      if (line.trim()) flush()
    })
  }

  function sectionHeading(title) {
    const lh = lineH
    y += L.sz.bodySize * PDF_SCALE * 1.2          // gap before heading
    ensure(head * 1.6 + lh * 2)                    // heading + 2 body lines
    doc.setFont(font, 'bold')
    doc.setFontSize(head)
    doc.setTextColor(...HEAD)
    doc.text(String(title).toUpperCase(), x, y + head * 0.85)
    y += head * 1.25
    if (L.heading === 'rule' || L.heading === 'accent') {
      doc.setDrawColor(...(L.heading === 'accent' ? hexToRgb(L.accent) : RULE))
      doc.setLineWidth(L.heading === 'accent' ? 1.4 : 1)
      doc.line(x, y, x + contentW, y)
      y += head * 0.35
    }
    y += head * 0.2
  }

  // ---------- header --------------------------------------------------------
  if (L.band) {
    // creative: filled accent band, white/dark text, optional photo
    const fg = onAccent(L.accent)
    // band padding mirrors preview: 0.55 * margin top/bottom
    const pad = margin * 0.55
    let bandH = pad
    bandH += nameSz * 1.3
    if (L.headline) bandH += body * 1.45
    bandH += L.contact.length * body * 1.45
    bandH += pad

    let photoData = ''
    let photoSize = 0
    if (L.photo) {
      photoData = await shapePhoto(L.photo, L.photoShape)
      photoSize = Math.min(76, bandH - 20)
    }
    doc.setFillColor(...hexToRgb(L.accent))
    doc.rect(0, 0, pageW, bandH, 'F')

    let ty = pad
    const textW = photoData ? contentW - photoSize - 16 : contentW
    doc.setFont(font, 'bold')
    doc.setFontSize(nameSz)
    doc.setTextColor(...fg)
    doc.text(L.nameDisplay, x, ty + nameSz * 0.9, { maxWidth: textW })
    ty += nameSz * 1.3
    if (L.headline) {
      doc.setFont(font, 'normal')
      doc.setFontSize(body * 1.1)
      doc.text(L.headline, x, ty + body * 0.85, { maxWidth: textW })
      ty += body * 1.45
    }
    doc.setFontSize(body)
    L.contact.forEach(line => {
      doc.text(line, x, ty + body * 0.85, { maxWidth: textW })
      ty += body * 1.45
    })
    if (photoData) {
      try { doc.addImage(photoData, 'PNG', pageW - margin - photoSize, (bandH - photoSize) / 2, photoSize, photoSize) } catch {}
    }
    // preview: body padding-top (0.4m) + section margin-top (1.4 body)
    y = bandH + margin * 0.4 + body * 0.2
  } else {
    // ATS: plain centered/left text header, no colors, no graphics
    const align = L.align === 'center' ? 'center' : 'left'
    const ax = align === 'center' ? pageW / 2 : x

    doc.setFont(font, 'bold')
    doc.setFontSize(nameSz)
    doc.setTextColor(...HEAD)
    doc.text(L.nameDisplay, ax, y + nameSz * 0.9, { align })
    y += nameSz * 1.3

    if (L.headline) {
      doc.setFont(font, 'bold')
      doc.setFontSize(body * 1.1)
      doc.setTextColor(...TEXT)
      doc.text(L.headline, ax, y + body * 0.85, { align, maxWidth: contentW })
      y += body * 1.45
    }
    doc.setFont(font, 'normal')
    doc.setFontSize(body)
    doc.setTextColor(...MUTED)
    L.contact.forEach(line => {
      const wrapped = doc.splitTextToSize(line, contentW)
      wrapped.forEach(wl => {
        ensure(lineH)
        doc.text(wl, ax, y + body * 0.85, { align })
        y += lineH
      })
    })
    // matches preview: header bottom + body padding-top + section margin-top
    y += body * 1.4
  }

  // ---------- sections ------------------------------------------------------
  if (L.summary) {
    sectionHeading('Professional Summary')
    drawWrappedText(L.summary)
  }

  if (L.skillLines.length) {
    sectionHeading('Technical Skills')
    L.skillLines.forEach(g => {
      const label = g.label ? g.label + ': ' : ''
      const items = g.items.join(', ')
      if (!label) { drawRich([{ text: items }], 0); return }
      ensure(lineH * 2)
      // indent 0: preview wraps skill lines flush-left too (WYSIWYG)
      drawRich([
        { text: label, bold: true, color: HEAD },
        { text: items },
      ], 0)
    })
  }

  if (L.projects.length) {
    sectionHeading('Projects')
    L.projects.forEach(pr => {
      ensure(lineH * 2)
      const parts = [{ text: '- ' }]
      parts.push({ text: pr.title, bold: true, color: HEAD })
      if (pr.rest) parts.push({ text: ' - ' + pr.rest })
      drawRich(parts, 14)
      y += body * 0.2 // matches the 4px gap between preview bullets
    })
  }

  if (L.education) {
    sectionHeading('Education')
    drawWrappedText(L.education)
  }

  L.sections.forEach(sec => {
    sectionHeading(sec.title)
    drawWrappedText(sec.content)
  })

  return doc
}

// ---- shared silent save: Documents -> Cache -> Data -> browser download -----
export async function savePdfSilently(doc, filename) {
  if (Capacitor.isNativePlatform()) {
    const b64 = doc.output('datauristring').split(',')[1]
    const chain = [
      [Directory.Documents, 'PDF saved to Documents folder!'],
      [Directory.Cache, 'PDF saved to app cache!'],
      [Directory.Data, 'PDF saved to app storage!'],
    ]
    for (const [dir, msg] of chain) {
      try {
        await Filesystem.writeFile({ path: filename, data: b64, directory: dir, recursive: true })
        try { await Toast.show({ text: msg }) } catch {}
        return msg
      } catch {}
    }
    doc.save(filename)
    return 'PDF downloaded!'
  }
  doc.save(filename)
  return 'PDF downloaded!'
}

export async function exportResumePdf(p, savedId) {
  try {
    const doc = await buildResumePdf(p)
    // Meaningful, filesystem-safe filename (e.g. "NitinPratap_NitinNova_Resume.pdf").
    const fn = safePdfFilename(p && p.name)
    const msg = await savePdfSilently(doc, fn)
    return { ok: true, message: msg, filename: fn }
  } catch (e) {
    console.error('PDF error:', e)
    return { ok: false, message: 'Error: ' + (e.message || String(e)) }
  }
}
