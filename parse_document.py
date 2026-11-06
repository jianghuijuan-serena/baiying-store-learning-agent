import sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')

path = Path(sys.argv[1])
if path.suffix.lower() == '.pdf':
    import fitz
    doc = fitz.open(path)
    print('\n\n'.join(page.get_text() for page in doc))
elif path.suffix.lower() == '.docx':
    from docx import Document
    doc = Document(path)
    # Preserve paragraphs and table rows in document order.
    from docx.text.paragraph import Paragraph
    from docx.table import Table
    output = []
    for element in doc.element.body:
        if element.tag.endswith('}p'):
            text = Paragraph(element, doc).text.strip()
            if text:
                output.append(text)
        elif element.tag.endswith('}tbl'):
            for row in Table(element, doc).rows:
                output.append(' | '.join(cell.text.strip() for cell in row.cells))
    print('\n\n'.join(output))
else:
    raise SystemExit('unsupported file')
