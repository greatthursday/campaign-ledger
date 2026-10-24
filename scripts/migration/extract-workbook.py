"""Read an XLSX with Python's standard library; never alter the source workbook.
Resolve shared formulas and evaluate the limited arithmetic/SUM/ROUND used by this ledger.
Usage: python3 extract-workbook.py source.xlsx extracted.json
"""
import ast
import hashlib
import json
import re
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from fractions import Fraction
from pathlib import Path, PurePosixPath
from zipfile import ZipFile

NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
REF = re.compile(r'(\$?)([A-Z]+)(\$?)([0-9]+)')

def column_number(text):
    n = 0
    for char in text: n = n * 26 + ord(char) - 64
    return n

def column_name(n):
    text = ''
    while n: n, rem = divmod(n - 1, 26); text = chr(65 + rem) + text
    return text

def position(address):
    m = REF.fullmatch(address)
    if not m: raise ValueError('Invalid cell address')
    return column_number(m[2]), int(m[4])

def translate(formula, origin, destination):
    ox, oy = position(origin); dx, dy = position(destination)
    return REF.sub(lambda m: m[1] + (m[2] if m[1] else column_name(column_number(m[2]) + dx - ox)) + m[3] + str(int(m[4]) if m[3] else int(m[4]) + dy - oy), formula)

def cells_in_range(start, end):
    ax, ay = position(start); bx, by = position(end)
    return [column_name(x) + str(y) for y in range(ay, by + 1) for x in range(ax, bx + 1)]

class Evaluator:
    def __init__(self, cells): self.cells = cells; self.cache = {}; self.active = set()
    def cell(self, address):
        address = address.replace('$', '')
        if address in self.cache: return self.cache[address]
        if address in self.active: raise ValueError('Circular formula at ' + address)
        cell = self.cells.get(address)
        if not cell: return Fraction(0)
        self.active.add(address)
        try:
            if cell['formula']:
                formula = re.sub(r'\s+', '', cell['formula'])
                refs = []
                def keep(value): refs.append(value); return 'RANGE_' + str(len(refs) - 1)
                formula = re.sub(r'(\$?[A-Z]+\$?[0-9]+):(\$?[A-Z]+\$?[0-9]+)', lambda m: keep((m[1], m[2])), formula)
                formula = REF.sub(lambda m: 'CELL("' + m[0].replace('$', '') + '")', formula)
                formula = re.sub(r'RANGE_([0-9]+)', lambda m: 'RANGE("' + refs[int(m[1])][0].replace('$', '') + '","' + refs[int(m[1])][1].replace('$', '') + '")', formula)
                result = self.expression(ast.parse(formula, mode='eval').body)
            elif cell['type'] == 'number': result = Fraction(cell['value'])
            elif cell['value'] is None or not str(cell['value']).strip(): result = Fraction(0)
            else: raise ValueError('Text used as numeric input at ' + address)
            self.cache[address] = result
            return result
        finally: self.active.remove(address)
    def expression(self, node):
        if isinstance(node, ast.Constant): return node.value if isinstance(node.value, str) else Fraction(str(node.value))
        if isinstance(node, ast.BinOp):
            left, right = self.expression(node.left), self.expression(node.right)
            if isinstance(node.op, ast.Add): return left + right
            if isinstance(node.op, ast.Sub): return left - right
            if isinstance(node.op, ast.Mult): return left * right
            if isinstance(node.op, ast.Div): return left / right
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.USub, ast.UAdd)):
            result = self.expression(node.operand); return -result if isinstance(node.op, ast.USub) else result
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            name = node.func.id.upper(); args = [self.expression(a) for a in node.args]
            if name == 'CELL': return self.cell(args[0])
            if name == 'RANGE':
                values = []
                for address in cells_in_range(*args):
                    cell = self.cells.get(address)
                    if cell and cell['type'] == 'text' and not cell['formula']: continue
                    values.append(self.cell(address))
                return values
            if name == 'SUM': return sum((sum(a, Fraction(0)) if isinstance(a, list) else a for a in args), Fraction(0))
            if name == 'ROUND':
                value, digits = args; scale = Fraction(10) ** int(digits); scaled = abs(value * scale)
                rounded = (scaled.numerator * 2 + scaled.denominator) // (scaled.denominator * 2)
                return (rounded if value >= 0 else -rounded) / scale
        raise ValueError('Unsupported formula expression: ' + ast.dump(node))

def split_formula(formula):
    if not formula: return None
    try:
        node = ast.parse(re.sub(r'\s+', '', formula), mode='eval').body
        factor = Fraction(1)
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Mult) and isinstance(node.right, ast.Constant):
            factor = Fraction(str(node.right.value)); node = node.left
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Div) and isinstance(node.left, ast.Constant) and isinstance(node.right, ast.Constant):
            numerator, divisor = Fraction(str(node.left.value)), Fraction(str(node.right.value))
            if numerator >= 0 and divisor > 0:
                return {'inputValue': float(numerator), 'multiplier': float(factor), 'divisor': float(divisor)}
    except (ValueError, SyntaxError, TypeError): pass
    return None

def extract(path):
    raw = Path(path).read_bytes()
    with ZipFile(path) as archive:
        strings = [''.join(node.itertext()) for node in ET.fromstring(archive.read('xl/sharedStrings.xml'))] if 'xl/sharedStrings.xml' in archive.namelist() else []
        workbook = ET.fromstring(archive.read('xl/workbook.xml'))
        relationships = {r.get('Id'): r.get('Target') for r in ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))}
        props = workbook.find('s:workbookPr', NS)
        epoch = datetime(1904, 1, 1) if props is not None and props.get('date1904') in ('1', 'true') else datetime(1899, 12, 30)
        sheets = []
        for sheet in workbook.findall('s:sheets/s:sheet', NS):
            target = relationships[sheet.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')]
            member = target.lstrip('/') if target.startswith('/') else str(PurePosixPath('xl') / target)
            root = ET.fromstring(archive.read(member)); cells = {}; shared = {}; pending = []
            for cell in root.findall('s:sheetData/s:row/s:c', NS):
                address = cell.get('r'); value_node = cell.find('s:v', NS); formula_node = cell.find('s:f', NS)
                value = value_node.text if value_node is not None else None; kind = cell.get('t')
                if kind == 's' and value is not None: value = strings[int(value)]; kind = 'text'
                elif kind == 'inlineStr': value = ''.join(cell.find('s:is', NS).itertext()); kind = 'text'
                elif kind == 'e': kind = 'error'
                elif kind in ('str', 'b'): kind = 'text'
                else: kind = 'number'
                formula = formula_node.text if formula_node is not None else None
                if formula_node is not None and formula_node.get('t') == 'shared':
                    index = formula_node.get('si')
                    if formula: shared[index] = (address, formula)
                    else: pending.append((address, index))
                if value is not None or formula_node is not None:
                    cells[address] = {'cell': address, 'type': kind, 'value': value, 'formula': formula, 'style': cell.get('s')}
            for address, index in pending: cells[address]['formula'] = translate(shared[index][1], shared[index][0], address)
            evaluator = Evaluator(cells)
            for address, cell in cells.items():
                if cell['type'] == 'number' and (cell['value'] is not None or cell['formula']):
                    try:
                        result = evaluator.cell(address); cell['exact'] = f'{result.numerator}/{result.denominator}'; cell['calculated'] = float(result); cell['split'] = split_formula(cell['formula'])
                    except Exception as error: cell['calculationError'] = str(error)
            for col in ['B', 'H', 'Q']:
                for address, cell in cells.items():
                    if re.fullmatch(col + r'[0-9]+', address) and cell['type'] == 'number' and cell['value'] is not None:
                        cell['excelDate'] = (epoch + timedelta(days=float(cell['value']))).date().isoformat()
            sheets.append({'name': sheet.get('name'), 'cells': cells})
        return {'filename': Path(path).name, 'sha256': hashlib.sha256(raw).hexdigest(), 'sheets': sheets}

if __name__ == '__main__':
    result = extract(sys.argv[1]); Path(sys.argv[2]).write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({'sheets': [{'name': s['name'], 'cells': len(s['cells'])} for s in result['sheets']], 'sha256': result['sha256']}))
