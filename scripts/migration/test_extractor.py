import unittest
from fractions import Fraction
from importlib.util import spec_from_file_location, module_from_spec
from pathlib import Path
spec = spec_from_file_location('extractor', Path(__file__).with_name('extract-workbook.py'))
m = module_from_spec(spec); spec.loader.exec_module(m)
class FormulaTests(unittest.TestCase):
    def test_shared_formula_translation(self):
        self.assertEqual(m.translate('C4+C4*0.25', 'E4', 'E133'), 'C133+C133*0.25')
        self.assertEqual(m.translate('$C4+C$4', 'E4', 'F5'), '$C5+D$4')
    def test_exact_arithmetic_and_sum_ignore_text(self):
        cells = {'A1': {'type':'number','value':'1','formula':None},'A2':{'type':'number','value':None,'formula':'2000/3'},'A3':{'type':'text','value':'note','formula':None},'B1':{'type':'number','value':None,'formula':'SUM(A1:A3)*1.25'}}
        self.assertEqual(m.Evaluator(cells).cell('B1'), Fraction(10015,12))
    def test_round_half_away_from_zero(self):
        for expression, result in [('ROUND(2.5,0)',3),('ROUND(-2.5,0)',-3),('ROUND(31455/7,0)*2',8988)]:
            self.assertEqual(m.Evaluator({'A1':{'type':'number','value':None,'formula':expression}}).cell('A1'),result)
    def test_split_recognition_and_no_rounded_split_guess(self):
        self.assertEqual(m.split_formula('1500/\t11*2'),{'inputValue':1500.0,'divisor':11.0,'multiplier':2.0})
        self.assertEqual(m.split_formula('11700/5.5')['divisor'],5.5)
        self.assertIsNone(m.split_formula('ROUND(31455/7,0)*2'))
    def test_unsupported_or_circular_expressions_fail(self):
        for formula in ['A1+1','__import__("os")']:
            with self.assertRaises(ValueError):m.Evaluator({'A1':{'type':'number','value':None,'formula':formula}}).cell('A1')
if __name__ == '__main__':unittest.main()
