#!/usr/bin/env python3
"""
Regression tests for scripts/kicd/parse_kicd_design.py against real KICD
designs in data/kicd-pdfs/. Needs python3 + poppler's pdftotext.

  python3 -m unittest scripts/kicd/test_parse_kicd_design.py
"""
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from parse_kicd_design import parse  # noqa: E402


def sub(design, number):
    return next(s for st in design['strands'] for s in st['sub_strands'] if s['number'] == number)


class IntegratedScienceGrade8(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.d = parse(os.path.join(ROOT, 'data/kicd-pdfs/jss/integrated-science-grade8.pdf'))

    def test_strands_and_titles(self):
        self.assertEqual([(s['number'], s['title']) for s in self.d['strands']],
                         [('1', 'MIXTURES, ELEMENTS AND COMPOUNDS'), ('2', 'LIVING THINGS AND THEIR ENVIRONMENT'), ('3', 'FORCE AND ENERGY')])

    def test_classes_of_fire_columns_are_not_shifted(self):
        s = sub(self.d, '1.3')
        self.assertEqual(s['title'], '1.3 Classes of fire')
        self.assertEqual(s['suggested_lessons'], 20)
        self.assertEqual(s['learning_outcomes'], [
            'identify causes of fire in nature',
            'explain the role of the components of fire triangle in the spread of fire',
            'describe ways of controlling different classes of fires',
            'acknowledge the dangers of fires in nature',
        ])
        self.assertEqual(s['learning_experiences'][0], 'discuss the possible causes of fire in nature')
        self.assertEqual(s['key_inquiry_questions'], ['What are the dangers of fire in nature?'])
        self.assertEqual(s['core_competencies'], ['Citizenship', 'Communication and collaboration'])
        self.assertEqual(s['values'], ['Respect', 'Responsibility'])
        self.assertEqual(s['pcis'], ['Safety and security'])
        self.assertIn('Dangers of fires', s['content'])

    def test_no_appendix_or_furniture_leaks(self):
        for st in self.d['strands']:
            for s in st['sub_strands']:
                self.assertNotIn('APPENDIX 2', s['values'])
                for q in s['key_inquiry_questions']:
                    self.assertNotIn('question(s)', q.lower())


class KiswahiliGrade9(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.d = parse(os.path.join(ROOT, 'data/kicd-pdfs/kiswahili-grade9.pdf'))

    def test_fifteen_themes_four_sub_strands_each(self):
        self.assertEqual(len(self.d['strands']), 15)
        self.assertTrue(all(len(st['sub_strands']) == 4 for st in self.d['strands']))

    def test_mnyambuliko_attributes(self):
        s = sub(self.d, '11.4.1')
        self.assertTrue(s['learning_outcomes'][0].startswith('kutambua viambishi vya kauli ya kutendana'))
        self.assertEqual(s['suggested_lessons'], 2)
        self.assertIn('Mawasiliano na ushirikiano', s['core_competencies'])
        self.assertEqual(s['values'], ['Heshima', 'Uwajibikaji', 'Umoja'])


class EnglishGrade8Themes(unittest.TestCase):
    def test_theme_titles_without_dot_zero(self):
        d = parse(os.path.join(ROOT, 'data/kicd-pdfs/jss/english-grade8.pdf'))
        titles = [s['title'] for s in d['strands']]
        self.assertEqual(len(titles), 15)
        self.assertEqual(titles[2], 'POLLUTION')
        self.assertEqual(titles[9], 'ART')


if __name__ == '__main__':
    unittest.main()
