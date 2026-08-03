// Generador mínimo de PDF (PDF 1.4, fuente base Helvetica).
// No usa dependencias externas; soporta texto en Latin-1 con acentos comunes.

const PAGE_W: f64 = 595.28;
const PAGE_H: f64 = 841.89;
const MARGIN_L: f64 = 40.0;
const MARGIN_T: f64 = 40.0;
const MARGIN_B: f64 = 40.0;
const ROW_H: f64 = 17.0;

fn sanitize_latin1(s: &str) -> String {
    s.chars()
        .map(|c| {
            let cp = c as u32;
            if cp <= 0xFF {
                c
            } else {
                match c {
                    'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u',
                    'Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ú' => 'U',
                    'ñ' => 'n', 'Ñ' => 'N', 'ü' => 'u', 'Ü' => 'U',
                    '¿' => '?', '¡' => '!', '•' => '-', '—' => '-', '–' => '-',
                    '“' => '"', '”' => '"', '‘' => '\'', '’' => '\'',
                    _ => '?',
                }
            }
        })
        .collect()
}

fn escape_pdf_text(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in sanitize_latin1(s).chars() {
        match c {
            '(' => out.push_str("\\("),
            ')' => out.push_str("\\)"),
            '\\' => out.push_str("\\\\"),
            _ => out.push(c),
        }
    }
    out
}

fn truncate(s: &str, max_chars: usize) -> String {
    let mut count = 0;
    let mut out = String::new();
    for c in s.chars() {
        if count >= max_chars {
            out.push_str("...");
            break;
        }
        out.push(c);
        count += 1;
    }
    out
}

struct Page {
    content: String,
    y: f64,
}

struct PdfDoc {
    pages: Vec<Page>,
}

impl PdfDoc {
    fn new() -> Self {
        PdfDoc { pages: vec![Page { content: String::new(), y: PAGE_H - MARGIN_T }] }
    }

    fn ensure_page(&mut self, needed: f64) {
        let current = self.pages.last_mut().unwrap();
        if current.y - needed < MARGIN_B {
            self.pages.push(Page { content: String::new(), y: PAGE_H - MARGIN_T });
        }
    }

    fn text(&mut self, font_bold: bool, size: f64, x: f64, text: &str) {
        self.ensure_page(ROW_H);
        let page = self.pages.last_mut().unwrap();
        let font = if font_bold { "F2" } else { "F1" };
        let s = escape_pdf_text(text);
        page.content.push_str(&format!(
            "BT /{} {} Tf 1 0 0 1 {} {} Tm ({}) Tj ET\n",
            font,
            size,
            x,
            page.y,
            s
        ));
        page.y -= ROW_H;
    }

    fn title(&mut self, text: &str) {
        self.text(true, 16.0, MARGIN_L, text);
        self.pages.last_mut().unwrap().y += ROW_H * 0.6;
    }

    fn subtitle(&mut self, text: &str) {
        self.text(false, 10.0, MARGIN_L, text);
        self.pages.last_mut().unwrap().y += ROW_H * 0.4;
    }

    fn spacer(&mut self, rows: f64) {
        let page = self.pages.last_mut().unwrap();
        if page.y - rows * ROW_H < MARGIN_B {
            self.pages.push(Page { content: String::new(), y: PAGE_H - MARGIN_T });
        } else {
            page.y -= rows * ROW_H;
        }
    }

    fn table(&mut self, headers: &[&str], rows: &[Vec<String>], col_widths: &[f64]) {
        let total_w: f64 = col_widths.iter().sum();
        let scale = (PAGE_W - MARGIN_L * 2.0) / total_w;

        // Header row
        self.ensure_page(ROW_H);
        {
            let page = self.pages.last_mut().unwrap();
            let mut x = MARGIN_L;
            for (i, h) in headers.iter().enumerate() {
                let cell_w = col_widths[i] * scale;
                let max_chars = ((cell_w / 5.0) as usize).max(3);
                let s = truncate(h, max_chars);
                page.content.push_str(&format!(
                    "BT /F2 10 Tf 1 0 0 1 {} {} Tm ({}) Tj ET\n",
                    x,
                    page.y,
                    escape_pdf_text(&s)
                ));
                x += cell_w;
            }
            page.content.push_str("0.5 w 40 0 m 555 0 l S\n");
            page.y -= ROW_H;
        }

        for row in rows {
            self.ensure_page(ROW_H);
            let page = self.pages.last_mut().unwrap();
            let mut x = MARGIN_L;
            for (i, cell) in row.iter().enumerate() {
                let cell_w = if i < col_widths.len() { col_widths[i] } else { 0.0 } * scale;
                let max_chars = ((cell_w / 5.0) as usize).max(3);
                let s = truncate(cell, max_chars);
                page.content.push_str(&format!(
                    "BT /F1 10 Tf 1 0 0 1 {} {} Tm ({}) Tj ET\n",
                    x,
                    page.y,
                    escape_pdf_text(&s)
                ));
                x += cell_w;
            }
            page.y -= ROW_H;
        }
    }

    fn render(self) -> Vec<u8> {
        let n = self.pages.len();
        let mut out = Vec::new();
        out.extend_from_slice(b"%PDF-1.4\n");

        // Object numbers: 1 = catalog, 2 = pages, 3 = font regular, 4 = font bold
        // 5..5+n-1 = page objects, 5+n = page content stream? Use one content object per page.
        // Layout: 5 + i = page i, then 5+n + i = content stream i.
        let content_start = 5 + n;
        let mut offsets: Vec<usize> = Vec::new();

        let mut push = |out: &mut Vec<u8>, obj_body: String| -> usize {
            offsets.push(out.len());
            out.extend_from_slice(format!("{} 0 obj\n{}\nendobj\n", offsets.len() + 1, obj_body).as_bytes());
            offsets.len()
        };

        push(&mut out, "<< /Type /Catalog /Pages 2 0 R >>".to_string());

        let kids: String = (0..n).map(|i| format!("{} 0 R ", 5 + i)).collect();
        push(&mut out, format!("<< /Type /Pages /Kids [ {}] /Count {} >>", kids, n));

        push(&mut out, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>".to_string());
        push(&mut out, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>".to_string());

        for i in 0..n {
            push(&mut out, format!(
                "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {} {}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents {} 0 R >>",
                PAGE_W, PAGE_H, content_start + i
            ));
        }

        for page in &self.pages {
            let stream = page.content.clone();
            push(&mut out, format!("<< /Length {} >>\nstream\n{}\nendstream", stream.len(), stream));
        }

        let xref_start = out.len();
        let xref_size = offsets.len() + 1;
        out.extend_from_slice(format!("xref\n0 {}\n0000000000 65535 f \n", xref_size).as_bytes());
        for off in &offsets {
            out.extend_from_slice(format!("{:010} 00000 n \n", off).as_bytes());
        }
        out.extend_from_slice(format!("trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{}\n%%EOF\n", xref_size, xref_start).as_bytes());
        out
    }
}

/// Construye un PDF con título, subtítulo y tabla. `rows` son celdas en orden de fila.
pub fn build_report_pdf(title: &str, subtitle: &str, headers: &[&str], rows: &[Vec<String>]) -> Vec<u8> {
    let mut doc = PdfDoc::new();
    doc.title(title);
    doc.subtitle(subtitle);
    doc.spacer(0.8);

    let n = headers.len().max(1);
    let equal = (PAGE_W - MARGIN_L * 2.0) / n as f64;
    let col_widths: Vec<f64> = headers.iter().map(|_h| equal).collect();
    doc.table(headers, rows, &col_widths);
    doc.render()
}
