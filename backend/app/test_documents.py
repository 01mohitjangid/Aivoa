import io

import pytest
from docx import Document
from pypdf import PdfWriter

from app.documents import UnsupportedDocument, extract_text

EML = b"""From: qa@medpharma.example
To: complaints@aivoa-pharma.example
Subject: Complaint - Metformin 500 mg batch MF-2409-114
Date: Mon, 1 Sep 2026 10:15:00 +0530
Content-Type: text/plain; charset="utf-8"

Dear QA team, brown spots were observed on tablets.
"""


def test_each_supported_type_yields_text_and_others_are_rejected():
    text = extract_text("complaint.eml", EML)
    assert "Subject: Complaint - Metformin 500 mg batch MF-2409-114" in text
    assert "brown spots were observed" in text

    assert extract_text("note.TXT", "café lot A1".encode()) == "café lot A1"

    html_eml = EML.replace(b'text/plain; charset="utf-8"', b'text/html; charset="utf-8"').replace(
        b"Dear QA team, brown spots were observed on tablets.",
        b"<p>Dear QA team,&nbsp;brown &amp; yellow spots on &lt;15%&gt; of strips.</p>",
    )
    assert "Dear QA team,\xa0brown & yellow spots on <15%> of strips." in extract_text(
        "c.eml", html_eml
    )

    doc = Document()
    doc.add_paragraph("Complaint form")
    table = doc.add_table(rows=1, cols=2)
    table.rows[0].cells[0].text, table.rows[0].cells[1].text = "Batch", "AMX-2507-033"
    buf = io.BytesIO()
    doc.save(buf)
    assert extract_text("form.docx", buf.getvalue()) == "Complaint form\nBatch | AMX-2507-033"

    pdf = io.BytesIO()
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    writer.write(pdf)
    assert extract_text("blank.pdf", pdf.getvalue()) == ""

    with pytest.raises(UnsupportedDocument):
        extract_text("photo.png", b"\x89PNG")
