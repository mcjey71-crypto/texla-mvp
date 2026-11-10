"""Synthetic two-page tagged PDF; developer-only regeneration requires pypdf."""
from pathlib import Path
from pypdf import PdfWriter
from pypdf.generic import (
    DictionaryObject as D, NameObject as N, NumberObject as I,
    ArrayObject as A, DecodedStreamObject,
)

writer = PdfWriter()
pages = [writer.add_blank_page(595, 842) for _ in range(2)]
def obj(values):
    return writer._add_object(D({N(k): v for k, v in values.items()}))
regular = obj({'/Type': N('/Font'), '/Subtype': N('/Type1'), '/BaseFont': N('/Helvetica')})
bold = obj({'/Type': N('/Font'), '/Subtype': N('/Type1'), '/BaseFont': N('/Helvetica-Bold')})
image = DecodedStreamObject()
image.set_data(bytes([45, 95, 75]) * 16 * 16)
image.update({N('/Type'): N('/XObject'), N('/Subtype'): N('/Image'), N('/Width'): I(16), N('/Height'): I(16), N('/ColorSpace'): N('/DeviceRGB'), N('/BitsPerComponent'): I(8)})
image_ref = writer._add_object(image)
root = obj({'/Type': N('/StructTreeRoot')})
document = obj({'/Type': N('/StructElem'), '/S': N('/Document'), '/P': root})
table = obj({'/Type': N('/StructElem'), '/S': N('/Table'), '/P': document})
parent_arrays = [A(), A()]
streams = ['', '']
def text(page_index, mcid, text_value, x, y, font='F1'):
    streams[page_index] += f'/P <</MCID {mcid}>> BDC BT /{font} 10 Tf {x} {y} Td ({text_value}) Tj ET EMC\n'
def element(role, parent, page_index, mcid):
    ref = obj({'/Type': N('/StructElem'), '/S': N('/' + role), '/P': parent,
               '/Pg': pages[page_index].indirect_reference, '/K': I(mcid)})
    parent_arrays[page_index].append(ref)
    return ref
heading = element('H1', document, 0, 0)
text(0, 0, 'RESULTADOS DEL PROYECTO', 72, 740, 'F2')
rows = A()
for index, values in enumerate([('Variable', 'Resultado'), ('Masa', '12 gramos'), ('Tiempo', '30 segundos')]):
    page_index = 0 if index == 0 else 1
    row = obj({'/Type': N('/StructElem'), '/S': N('/TR'), '/P': table})
    cells = A()
    for col, value in enumerate(values):
        mcid = len(parent_arrays[page_index])
        cells.append(element('TH' if index == 0 else 'TD', row, page_index, mcid))
        text(page_index, mcid, value, 72 + col * 230, 700 - (index % 2) * 30)
    row.get_object()[N('/K')] = cells
    rows.append(row)
table.get_object()[N('/K')] = rows
figure = element('Figure', document, 0, len(parent_arrays[0]))
# Between heading and table, so the table still ends page one and can continue.
streams[0] += '/Figure <</MCID 3>> BDC q 40 0 0 20 72 712 cm /Im0 Do Q EMC\n'
document.get_object()[N('/K')] = A([heading, figure, table])
root.get_object()[N('/K')] = A([document])
root.get_object()[N('/ParentTree')] = obj({'/Nums': A([I(0), parent_arrays[0], I(1), parent_arrays[1]])})
root.get_object()[N('/ParentTreeNextKey')] = I(2)
writer._root_object[N('/StructTreeRoot')] = root
writer._root_object[N('/MarkInfo')] = D({N('/Marked'): __import__('pypdf').generic.BooleanObject(True)})
for i, page in enumerate(pages):
    page[N('/StructParents')] = I(i)
    page[N('/Resources')] = D({N('/Font'): D({N('/F1'): regular, N('/F2'): bold}), N('/XObject'): D({N('/Im0'): image_ref})})
    stream = DecodedStreamObject()
    stream.set_data(streams[i].encode('ascii'))
    page[N('/Contents')] = writer._add_object(stream)
writer.write(Path('tests/fixtures/import/tagged-tables.pdf'))
