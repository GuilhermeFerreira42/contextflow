# tests/test_ai_governance.py
import unittest
import os
import sys
import json

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.ai_governance import TokenCounter, AICostCalculator, AICacheManager
from storage.db_handler import DatabaseHandler

class TestAIGovernance(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.test_db_path = "test_contextflow.db"
        cls.db = DatabaseHandler(cls.test_db_path)
        cls.prices_path = "test_ai_prices.json"
        
        # Mock prices
        prices = {
            "openai": {
                "gpt-4o": {"input_1k": 0.01, "output_1k": 0.03}
            }
        }
        with open(cls.prices_path, "w") as f:
            json.dump(prices, f)

    @classmethod
    def tearDownClass(cls):
        # if os.path.exists(cls.test_db_path):
        #     os.remove(cls.test_db_path)
        # if os.path.exists(cls.prices_path):
        #     os.remove(cls.prices_path)
        pass

    def test_token_counting(self):
        text = "Hello world"
        count = TokenCounter.count_tokens(text)
        self.assertGreater(count, 0)

    def test_cost_calculation(self):
        calc = AICostCalculator(self.prices_path)
        cost = calc.estimate_cost(1000, 2000, model="gpt-4o", provider="openai")
        # 1k input ($0.01) + 2k output ($0.06) = $0.07
        self.assertEqual(cost, 0.07)

    def test_deterministic_hash(self):
        manager = AICacheManager(self.db)
        vid = "vid1"
        text1 = "  text with   spaces  "
        text2 = "text with spaces"
        checksum = "abc"
        
        hash1 = manager.generate_hash(vid, text1, checksum)
        hash2 = manager.generate_hash(vid, text2, checksum)
        
        self.assertEqual(hash1, hash2)
        
        hash3 = manager.generate_hash(vid, text2, "diff")
        self.assertNotEqual(hash1, hash3)

    def test_cache_logic(self):
        manager = AICacheManager(self.db)
        h_key = "test_hash"
        response = {"summary": "done"}
        checksum = "sum1"
        
        manager.save_to_cache(h_key, response, checksum, "gpt-4o")
        
        # Hit
        cached = manager.get_cached_response(h_key, checksum)
        self.assertEqual(cached, response)
        
        # Miss Due to Checksum (Contract Invariant 2.2)
        cached_miss = manager.get_cached_response(h_key, "sum2")
        self.assertIsNone(cached_miss)

if __name__ == '__main__':
    unittest.main()
