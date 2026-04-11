import pdfplumber, re, json, sys

def pn(s):
    if not s or str(s).strip() in ['-', '', 'None']:
        return 0
    s = re.sub(r'[^\d]', '', str(s).strip())
    return int(s) if s else 0

fp = sys.argv[1]
result = {}
report_date = None
days = None

with pdfplumber.open(fp) as pdf:
    page = pdf.pages[0]
    text = page.extract_text() or ''
    m = re.search(r'Report Date:\s*(\d{2})-(\d{2})-(\d{4})', text)
    if m:
        d, mo, y = m.groups()
        report_date = f"{y}-{mo}-{d}"
        days = int(d)
    tables = page.extract_tables()
    if tables:
        regions = {'Delhi','Karnataka','Telangana','Maharashtra','Gujarat','Punjab'}
        for row in tables[0]:
            if not row or len(row) < 7:
                continue
            region = str(row[1] or '').strip()
            if region not in regions:
                continue
            store = str(row[3] or '').strip()
            if not store or store == 'Total':
                continue
            adt = pn(row[4])
            apc = pn(row[5])
            sales = pn(row[6])
            ads = sales // days if days and days > 0 else 0
            result[store] = {'ads': ads, 'adt': adt, 'apc': apc, 'salesMTD': sales, 'region': region}

total = sum(s['salesMTD'] for s in result.values())
valid = [s for s in result.values() if s['adt'] > 0]
avg_adt = sum(s['adt'] for s in valid) // len(valid) if valid else 0
avg_apc = sum(s['apc'] for s in valid) // len(valid) if valid else 0

print(json.dumps({
    'month': report_date[:7] if report_date else None,
    'reportDate': report_date,
    'days': days,
    'summary': {'totalMTDSales': total, 'avgADT': avg_adt, 'avgAPC': avg_apc, 'storeCount': len(result), 'indiaADT': avg_adt, 'indiaAPC': avg_apc},
    'stores': result
}))
