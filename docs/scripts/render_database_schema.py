"""Render the exported schema as editable SVG figures and a four-page vector PDF.

Install reportlab for authoring. Install pymupdf separately for optional PNG QA.
No MongoDB connection or application mutations are performed.
"""
from pathlib import Path
import json
import math
import html
import sys

ROOT = Path(__file__).resolve().parents[2]
temporary_deps = ROOT / 'tmp' / 'schema-tools'
if temporary_deps.exists():
    sys.path.insert(0, str(temporary_deps))
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

DATA = json.loads((ROOT / 'docs/database_schema.json').read_text(encoding='utf-8'))
COLLECTIONS = {item['model']: item for item in DATA['collections']}
W, H = 1190.55, 841.89  # A3 landscape, points; all PDF text remains vector.
INK, MUTED, LINE = '#18352F', '#536760', '#CBD8D2'
TEAL, LIGHT, WHITE = '#1F6053', '#F1F6F3', '#FFFFFF'
FONT_DIR = Path('C:/Windows/Fonts')
if FONT_DIR.exists():
    pdfmetrics.registerFont(TTFont('Schema', str(FONT_DIR / 'arial.ttf')))
    pdfmetrics.registerFont(TTFont('SchemaBold', str(FONT_DIR / 'arialbd.ttf')))
    REGULAR, BOLD = 'Schema', 'SchemaBold'
else:
    REGULAR, BOLD = 'Helvetica', 'Helvetica-Bold'

OUT = ROOT / 'output/pdf'
OUT.mkdir(parents=True, exist_ok=True)
PDF = OUT / 'FLUX_Database_Schema.pdf'
pdf = canvas.Canvas(str(PDF), pagesize=(W, H))
pdf.setTitle('FLUX - Implemented Database Schema')
pdf.setAuthor('FLUX Project')
pdf.setSubject('16 MongoDB collections, embedded structures, and declared ObjectId references')


class Figure:
    def __init__(self, filename):
        self.filename = filename
        self.svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
                    '<title>FLUX implemented database schema</title>',
                    '<desc>MongoDB collections and application-level ObjectId references, exported from the Mongoose models.</desc>']
        self.rect(0, 0, W, H, WHITE, None)

    def rect(self, x, y, width, height, fill, stroke=LINE):
        pdf.setFillColor(fill)
        if stroke:
            pdf.setStrokeColor(stroke)
        pdf.setLineWidth(.8)
        pdf.rect(x, H-y-height, width, height, fill=1, stroke=bool(stroke))
        self.svg.append(f'<rect x="{x}" y="{y}" width="{width}" height="{height}" fill="{fill}" stroke="{stroke or "none"}" stroke-width="0.8"/>')

    def text(self, x, y, value, size=10, color=INK, bold=False, align='left', width=None):
        value = str(value)
        font = BOLD if bold else REGULAR
        text_width = pdfmetrics.stringWidth(value, font, size)
        if width is not None and text_width > width + .1:
            raise ValueError(f'Text overflow: {value!r}: {text_width:.1f} > {width:.1f}')
        pdf.setFont(font, size)
        pdf.setFillColor(color)
        if align == 'right':
            pdf.drawRightString(x, H-y, value)
        else:
            pdf.drawString(x, H-y, value)
        self.svg.append(f'<text x="{x}" y="{y}" fill="{color}" font-family="Arial, sans-serif" font-size="{size}" font-weight="{700 if bold else 400}" text-anchor="{"end" if align == "right" else "start"}">{html.escape(value)}</text>')

    def route(self, points, label=None, label_at=None, dashed=False):
        pdf.setStrokeColor(TEAL)
        pdf.setLineWidth(1.15)
        pdf.setDash(4, 3) if dashed else pdf.setDash()
        path = pdf.beginPath()
        path.moveTo(points[0][0], H-points[0][1])
        for x, y in points[1:]:
            path.lineTo(x, H-y)
        pdf.drawPath(path)
        pdf.setDash()
        coords = ' '.join(f'{x},{y}' for x, y in points)
        self.svg.append(f'<polyline points="{coords}" fill="none" stroke="{TEAL}" stroke-width="1.15"{ " stroke-dasharray=\"4 3\"" if dashed else ""}/>')
        x, y = points[-1]
        px, py = points[-2]
        angle = math.atan2(y-py, x-px)
        arrow = [(x, y)] + [(x-7*math.cos(angle+sign*.45), y-7*math.sin(angle+sign*.45)) for sign in [-1, 1]]
        p = pdf.beginPath()
        p.moveTo(arrow[0][0], H-arrow[0][1])
        for ax, ay in arrow[1:]:
            p.lineTo(ax, H-ay)
        p.close()
        pdf.setFillColor(TEAL)
        pdf.drawPath(p, fill=1, stroke=0)
        self.svg.append(f'<polygon points="{" ".join(f"{ax},{ay}" for ax, ay in arrow)}" fill="{TEAL}"/>')
        if label and label_at:
            lx, ly = label_at
            tw = pdfmetrics.stringWidth(label, BOLD, 9)
            self.rect(lx-3, ly-10, tw+6, 14, WHITE, None)
            self.text(lx, ly, label, 9, TEAL, bold=True)

    def box(self, model, x, y, width, rows):
        data = COLLECTIONS[model]
        height = 48 + len(rows)*15
        self.rect(x, y, width, height, WHITE)
        self.rect(x, y, width, 32, TEAL, None)
        self.text(x+12, y+21, data['collection'], 13, WHITE, True, width=width-24)
        for index, (name, kind) in enumerate(rows):
            baseline = y+51+index*15
            self.text(x+12, baseline, name, 10, width=width-112)
            self.text(x+width-12, baseline, kind, 9, MUTED, align='right', width=95)
        return height

    def header(self, number, title, subtitle):
        self.text(44, 37, 'FLUX / DATABASE DESIGN', 10, TEAL, True)
        self.text(44, 73, title, 25, INK, True)
        self.text(44, 96, subtitle, 10.5, MUTED, width=W-88)
        self.text(W-44, 37, f'AS IMPLEMENTED  /  {DATA["asOf"]}', 9, MUTED, align='right')
        self.rect(44, H-34, W-88, .7, LINE, None)
        self.text(44, H-17, 'Arrows: stored reference -> target collection. Rxx: relationship register on page 4. *: schema-required field.', 8.5, MUTED)
        self.text(W-44, H-17, f'{number} / 4', 9, MUTED, align='right')

    def finish(self):
        self.svg.append('</svg>')
        (ROOT / 'docs' / self.filename).write_text('\n'.join(self.svg), encoding='utf-8')
        pdf.showPage()


f = Figure('database_schema_core.svg')
f.header(1, 'Figure 10A. Sales and ingredient records', 'Collection overview. Selected fields are shown; the data dictionary contains all 318 field paths, including embedded records.')
f.box('Category', 44, 126, 260, [('_id [PK]', 'ObjectId'), ('name *', 'String')])
f.box('Product', 442, 126, 306, [('_id [PK]', 'ObjectId'), ('name *, category *', 'String'), ('categoryId [R01]', 'ObjectId ref'), ('price, soloPrice', 'Number'), ('platterPrice', 'Number'), ('description, image', 'String'), ('variants[]', 'String[]'), ('variantGroups[]', 'Document[]'), ('addons[] (copied values)', 'Document[]'), ('status, available', 'String / Boolean'), ('archived, archivedAt', 'Boolean / Date')])
f.box('Transaction', 884, 126, 262, [('_id [PK]', 'ObjectId'), ('receiptNo * [unique]', 'String'), ('cashier *, cashierEmail', 'String'), ('items[] [R07]', 'Document[]'), ('cancelledItems[] [R05,R06]', 'Document[]'), ('cancellationRefundId [R04]', 'ObjectId ref'), ('customerType, serviceType', 'String'), ('eliteMember, discountInfo', 'Objects'), ('subtotal *, total *', 'Number'), ('tax, discount', 'Number'), ('paymentMethod *', 'String')])
f.box('Inventory', 44, 372, 260, [('_id [PK]', 'ObjectId'), ('name * [unique]', 'String'), ('unit *', 'String'), ('stock *', 'Number'), ('lowStockAt', 'Number'), ('category', 'String'), ('expirationDate', 'Date'), ('expirationBatches[]', 'Document[]'), ('archived, archivedAt', 'Boolean / Date')])
f.box('Recipe', 442, 419, 306, [('_id [PK]', 'ObjectId'), ('productId * [R02]', 'ObjectId ref'), ('productName *', 'String'), ('ingredients[] [R03]', 'Document[]'), ('... amountPerServing', 'Number'), ('... platterMultiplier', 'Number')])
f.box('Refund', 884, 422, 262, [('_id [PK]', 'ObjectId'), ('transactionId * [R08]', 'ObjectId ref'), ('receiptNo *, reason *', 'String'), ('items[] [R09]', 'Document[]'), ('subtotal *, totalRefunded *', 'Number'), ('refundedBy *', 'String'), ('paymentMethod *', 'String'), ('status', 'String')])
f.box('Waste', 442, 626, 306, [('_id [PK]', 'ObjectId'), ('refundId * [R10]', 'ObjectId ref'), ('transactionId * [R11]', 'ObjectId ref'), ('receiptNo *', 'String'), ('items[] [R12]', 'Document[]'), ('... amountWasted', 'Number'), ('disposedBy *', 'String')])
f.route([(442, 172), (304, 172)], 'R01', (363, 164))
f.route([(570, 419), (570, 339)], 'R02', (581, 387))
f.route([(442, 478), (304, 478)], 'R03', (363, 470))
f.route([(884, 200), (748, 200)], 'R05, R07', (787, 192))
f.route([(1098, 339), (1098, 422)], 'R04, R06', (1060, 384))
f.route([(978, 422), (978, 339)], 'R08', (989, 399))
f.route([(884, 460), (815, 460), (815, 310), (748, 310)], 'R09', (781, 361))
f.route([(748, 675), (833, 675), (833, 545), (884, 545)], 'R10', (840, 649))
f.route([(748, 755), (864, 755), (864, 330), (884, 330)], 'R11', (824, 741))
f.route([(442, 720), (360, 720), (360, 530), (304, 530)], 'R12', (366, 644))
f.text(44, 676, 'Document storage', 12, TEAL, True)
for i, line in enumerate(['Items, recipes, variants, and expiration batches', 'use embedded arrays. Their child ObjectIds', 'refer to collections where indicated.', '', 'A reference does not enforce a foreign key.', 'Selected fields omit automatic timestamps', 'and version keys; see the full dictionary.']):
    f.text(44, 697+i*13, line, 9.5, MUTED, width=340)
f.finish()

f = Figure('database_schema_operations.svg')
f.header(2, 'Figure 10B. Accounts and procurement', 'Receiver assignments, purchase-order lines, delivery receipts, notifications, and account activity.')
f.box('User', 44, 126, 304, [('_id [PK]', 'ObjectId'), ('userId * [unique]', 'String'), ('name, email', 'String'), ('password, pin (hashes)', 'String'), ('role, jobRole', 'String'), ('permissions[]', 'String[]'), ('isOnline, lastSeenAt', 'Boolean / Date'), ('mustChangePassword', 'Boolean'), ('recovery challenge fields', 'Strings / Dates'), ('archived, archivedAt', 'Boolean / Date')])
f.box('PurchaseOrder', 442, 126, 356, [('_id [PK]', 'ObjectId'), ('purchaseOrderNo * [unique]', 'String'), ('supplierName *', 'String'), ('supplierContact', 'String'), ('orderDate, expectedDeliveryDate', 'Date'), ('status, notes', 'String'), ('assignedReceiver [R13]', 'Object'), ('items[] [R14]', 'Document[]'), ('receipts[] [R15]', 'Document[]'), ('pendingReceipts[]', 'Document[]'), ('createdBy, createdByEmail', 'String'), ('approvedBy, approvedAt', 'String / Date'), ('cancelledBy, cancelledAt', 'String / Date')])
f.box('Inventory', 912, 126, 234, [('_id [PK]', 'ObjectId'), ('name * [unique]', 'String'), ('stock *, unit *', 'Number / String'), ('expirationBatches[]', 'Document[]')])
f.text(912, 255, 'Repeated from Figure 10A.', 9, MUTED)
f.box('Notification', 44, 432, 304, [('_id [PK]', 'ObjectId'), ('type *, title *, message *', 'String'), ('purchaseOrderId [R16]', 'ObjectId ref'), ('purchaseOrderNo', 'String'), ('audiences[]', 'String[]'), ('readBy[]', 'Document[]'), ('resolvedAt', 'Date')])
f.box('LoginActivity', 44, 650, 304, [('_id [PK]', 'ObjectId'), ('userId [R17]', 'ObjectId ref'), ('name *, email *, role *', 'String'), ('action, staffId', 'String'), ('ipAddress, userAgent', 'String')])
f.route([(442, 188), (348, 188)], 'R13', (380, 180))
f.route([(798, 210), (912, 210)], 'R14, R15', (819, 202))
f.route([(348, 495), (390, 495), (390, 340), (442, 340)], 'R16', (395, 423))
f.route([(44, 708), (28, 708), (28, 300), (44, 300)], 'R17', (34, 633))
f.rect(442, 458, 704, 306, LIGHT)
f.text(460, 486, 'Embedded records inside purchase_orders', 14, TEAL, True)
detail = [
    ('assignedReceiver', 'userId ref -> users; copied name and email'),
    ('items[]', '_id, inventoryId ref, name, unit, ordered/received quantities, unitCost'),
    ('receipts[]', '_id, receivedAt, receivedBy, receivedByEmail, items[]'),
    ('receipts[].items[]', 'itemId -> this order\'s items[]._id; inventoryId ref -> inventory'),
    ('pendingReceipts[]', 'Arrival reporter, review status, reviewer, review time, reason, items[]'),
    ('pendingReceipts[].items[]', 'itemId -> this order\'s items[]._id; quantity, expiry, note'),
]
for i, (label, value) in enumerate(detail):
    yy = 518+i*36
    f.text(460, yy, label, 10.5, INK, True)
    f.text(460, yy+15, value, 9.5, MUTED, width=662)
f.text(460, 751, 'Only items[].inventoryId and receipts[].items[].inventoryId reference the inventory collection.', 9, MUTED, width=662)
f.finish()

f = Figure('database_schema_support.svg')
f.header(3, 'Figure 10C. Catalog and supporting records', 'These five collections declare no ObjectId references to other models. Text snapshots do not create reference relationships.')
f.box('Addon', 44, 126, 330, [('_id [PK]', 'ObjectId'), ('name *', 'String'), ('nameKey * [unique]', 'String'), ('price', 'Number'), ('active, archivedAt', 'Boolean / Date')])
f.box('Discount', 430, 126, 330, [('_id [PK]', 'ObjectId'), ('name *', 'String'), ('nameKey * [unique]', 'String'), ('percentage * (0-100)', 'Number'), ('scope (item / order)', 'String'), ('active, archivedAt', 'Boolean / Date')])
f.box('EmailVerification', 816, 126, 330, [('_id [PK]', 'ObjectId'), ('email * [unique]', 'String'), ('otpHash *', 'String'), ('expiresAt * [TTL]', 'Date'), ('attempts', 'Number')])
f.text(44, 279, 'Product add-ons copy names and prices.', 10, MUTED)
f.text(430, 294, 'Transactions store discountInfo snapshots.', 10, MUTED)
f.text(816, 279, 'TTL index uses expireAfterSeconds = 0.', 10, MUTED)
f.text(816, 295, 'Records are eligible for expiry at expiresAt.', 10, MUTED)
f.box('ForecastSnapshot', 44, 366, 520, [('_id [PK]', 'ObjectId'), ('dataset * [compound unique]', 'String'), ('targetDate * [compound unique]', 'String date'), ('source * (demo / real)', 'String'), ('predictedSales *', 'Number'), ('generatedAt *', 'Date'), ('trainedThrough *', 'String date'), ('method', 'String')])
f.box('SystemAudit', 626, 366, 520, [('_id [PK]', 'ObjectId'), ('module *, action *', 'String'), ('entityId, entityName', 'String snapshots'), ('actor, actorEmail', 'String snapshots'), ('details', 'String'), ('changes', 'Mixed'), ('createdAt, updatedAt', 'Date')])
f.text(44, 553, 'Unique key: dataset + targetDate. Automatic timestamps are disabled.', 10, MUTED)
f.text(626, 553, 'entityId is a string with a module context; no Mongoose ref is declared.', 10, MUTED)
f.rect(44, 612, 1102, 159, LIGHT)
f.text(62, 640, 'Storage boundaries for the paper', 14, TEAL, True)
for i, line in enumerate([
    'Elite Member details are embedded in transactions; saved member templates live in browser localStorage.',
    'Supplier names and contacts are embedded in purchase orders; supplier entry history also lives in browser localStorage.',
    'There is no separate Member, Supplier, Payment, OrderItem, DeliveryReceipt, or StockMovement model in this implementation.',
    'Stock movement history is represented through audit events; sales and refund quantities also reside in their respective records.',
    'All 16 collections have generated document identifiers and version keys. Category and ForecastSnapshot have no automatic timestamps.',
]):
    f.text(62, 665+i*19, line, 10, MUTED, width=1066)
f.finish()

f = Figure('database_schema_relationships.svg')
f.header(4, 'Declared ObjectId relationship register', 'The 17 references below correspond to the arrows in Figures 10A and 10B. MongoDB does not enforce their target existence.')
columns = [44, 104, 637, 875, 983, 1146]
f.rect(44, 126, 1102, 31, TEAL, None)
headers = ['ID', 'SOURCE COLLECTION / FIELD', 'TARGET COLLECTION', 'REQUIRED', 'STORAGE']
for x, label in zip(columns, headers):
    f.text(x+10, 146, label, 9.5, WHITE, True)
for index, ref in enumerate(DATA['references']):
    y = 157+index*28
    if index % 2 == 0:
        f.rect(44, y, 1102, 28, LIGHT, None)
    source = COLLECTIONS[ref['from']]['collection']+'.'+ref['path']
    target = COLLECTIONS[ref['to']]['collection']+'._id'
    values = [ref['id'], source, target, 'Yes' if ref['required'] else 'No', 'Embedded array' if ref['insideArray'] else 'Single reference']
    for left, right, value in zip(columns, columns[1:], values):
        f.text(left+10, y+18, value, 10, width=right-left-20)
f.text(44, 670, 'Relationship interpretation', 13, TEAL, True)
for i, line in enumerate([
    'A required reference field must contain an identifier when its containing document exists; target existence is an application concern.',
    'One target may be referenced by many source documents. Array references may point to multiple targets from one source document.',
    'No unique index is declared on recipes.productId; a one-recipe-per-product database guarantee must not be claimed.',
    'Receipt itemId values point to items[]._id inside the same purchase order; they are not links to a separate collection.',
    'Only selected attributes appear in the figures. Data_Dictionary.md and database_schema.json retain the full 318-path structure.',
]):
    f.text(44, 695+i*19, line, 10, MUTED, width=1102)
f.finish()
pdf.save()
print(f'Created {PDF} and four editable SVG pages.')

if '--preview' in sys.argv:
    import pymupdf
    preview_dir = ROOT / 'tmp/pdfs'
    preview_dir.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open(PDF)
    for i, page in enumerate(doc):
        page.get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5)).save(preview_dir / f'database-schema-{i+1}.png')
    print(f'Rendered {len(doc)} preview pages into {preview_dir}.')
