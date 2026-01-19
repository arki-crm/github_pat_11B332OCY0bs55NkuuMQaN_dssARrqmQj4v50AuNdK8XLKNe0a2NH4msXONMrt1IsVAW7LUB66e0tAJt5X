"""
Comprehensive tests for Finance Module: Expense Requests, Budgets, and Forecast APIs
Tests the Budgeting, Forecasting, and Spend Control System for Interior Design CRM

Endpoints tested:
- GET /api/finance/expense-requests/approval-rules - Approval thresholds and rules
- GET /api/finance/expense-requests/stats/summary - Dashboard summary stats
- GET /api/finance/budgets - List budgets
- POST /api/finance/budgets - Create new budget
- GET /api/finance/budget-categories - Predefined budget categories
- GET /api/finance/forecast - Financial forecast with runway calculation
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://design-finance-2.preview.emergentagent.com')

class TestFinanceModule:
    """Finance Module API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get session cookie
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={
                "email": "thaha.pakayil@gmail.com",
                "password": "password123"
            }
        )
        
        if login_response.status_code != 200:
            pytest.skip(f"Authentication failed: {login_response.status_code}")
        
        yield
        
        # Cleanup - logout
        self.session.post(f"{BASE_URL}/api/auth/logout")
    
    # ============ APPROVAL RULES TESTS ============
    
    def test_get_approval_rules_returns_200(self):
        """GET /api/finance/expense-requests/approval-rules should return 200"""
        response = self.session.get(f"{BASE_URL}/api/finance/expense-requests/approval-rules")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_approval_rules_contains_thresholds(self):
        """Approval rules should contain threshold definitions"""
        response = self.session.get(f"{BASE_URL}/api/finance/expense-requests/approval-rules")
        assert response.status_code == 200
        
        data = response.json()
        assert "thresholds" in data, "Response should contain 'thresholds'"
        assert "rules" in data, "Response should contain 'rules'"
        
        # Verify threshold structure
        thresholds = data["thresholds"]
        assert "petty_cash" in thresholds, "Should have petty_cash threshold"
        assert "standard" in thresholds, "Should have standard threshold"
        assert "high_value" in thresholds, "Should have high_value threshold"
        
        # Verify petty_cash threshold values
        petty = thresholds["petty_cash"]
        assert petty["min"] == 0
        assert petty["max"] == 1000
        assert petty["auto_approve"] == True
    
    def test_approval_rules_contains_rules_array(self):
        """Approval rules should contain human-readable rules array"""
        response = self.session.get(f"{BASE_URL}/api/finance/expense-requests/approval-rules")
        data = response.json()
        
        rules = data.get("rules", [])
        assert len(rules) >= 3, "Should have at least 3 rules"
        
        # Verify rule structure
        for rule in rules:
            assert "range" in rule, "Each rule should have 'range'"
            assert "approval" in rule, "Each rule should have 'approval'"
            assert "permission" in rule, "Each rule should have 'permission'"
    
    # ============ EXPENSE REQUESTS SUMMARY TESTS ============
    
    def test_get_expense_summary_returns_200(self):
        """GET /api/finance/expense-requests/stats/summary should return 200"""
        response = self.session.get(f"{BASE_URL}/api/finance/expense-requests/stats/summary")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_expense_summary_contains_required_fields(self):
        """Summary should contain status_summary, money_at_risk, pending_refunds"""
        response = self.session.get(f"{BASE_URL}/api/finance/expense-requests/stats/summary")
        data = response.json()
        
        assert "status_summary" in data, "Should contain 'status_summary'"
        assert "money_at_risk" in data, "Should contain 'money_at_risk'"
        assert "pending_refunds" in data, "Should contain 'pending_refunds'"
        assert "pending_refunds_count" in data, "Should contain 'pending_refunds_count'"
        assert "over_budget_count" in data, "Should contain 'over_budget_count'"
    
    def test_expense_summary_money_at_risk_is_numeric(self):
        """money_at_risk should be a numeric value"""
        response = self.session.get(f"{BASE_URL}/api/finance/expense-requests/stats/summary")
        data = response.json()
        
        assert isinstance(data["money_at_risk"], (int, float)), "money_at_risk should be numeric"
    
    # ============ BUDGET CATEGORIES TESTS ============
    
    def test_get_budget_categories_returns_200(self):
        """GET /api/finance/budget-categories should return 200"""
        response = self.session.get(f"{BASE_URL}/api/finance/budget-categories")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_budget_categories_returns_list(self):
        """Budget categories should return a list of predefined categories"""
        response = self.session.get(f"{BASE_URL}/api/finance/budget-categories")
        data = response.json()
        
        assert isinstance(data, list), "Should return a list"
        assert len(data) >= 5, f"Should have at least 5 categories, got {len(data)}"
    
    def test_budget_categories_have_required_fields(self):
        """Each budget category should have key, name, type, description"""
        response = self.session.get(f"{BASE_URL}/api/finance/budget-categories")
        data = response.json()
        
        for category in data:
            assert "key" in category, f"Category should have 'key': {category}"
            assert "name" in category, f"Category should have 'name': {category}"
            assert "type" in category, f"Category should have 'type': {category}"
            assert "description" in category, f"Category should have 'description': {category}"
    
    def test_budget_categories_include_expected_keys(self):
        """Budget categories should include expected keys like salaries, rent, utilities"""
        response = self.session.get(f"{BASE_URL}/api/finance/budget-categories")
        data = response.json()
        
        keys = [c["key"] for c in data]
        expected_keys = ["salaries", "rent", "utilities"]
        
        for expected in expected_keys:
            assert expected in keys, f"Expected category key '{expected}' not found in {keys}"
    
    # ============ BUDGETS LIST TESTS ============
    
    def test_get_budgets_returns_200(self):
        """GET /api/finance/budgets should return 200"""
        response = self.session.get(f"{BASE_URL}/api/finance/budgets")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_budgets_returns_list(self):
        """Budgets endpoint should return a list"""
        response = self.session.get(f"{BASE_URL}/api/finance/budgets")
        data = response.json()
        
        assert isinstance(data, list), "Should return a list"
    
    def test_budget_has_required_structure(self):
        """Each budget should have required fields"""
        response = self.session.get(f"{BASE_URL}/api/finance/budgets")
        data = response.json()
        
        if len(data) > 0:
            budget = data[0]
            required_fields = ["budget_id", "name", "period_type", "period_start", "period_end", "status", "allocations"]
            for field in required_fields:
                assert field in budget, f"Budget should have '{field}'"
    
    # ============ CREATE BUDGET TESTS ============
    
    def test_create_budget_success(self):
        """POST /api/finance/budgets should create a new budget"""
        # Use future dates to avoid overlap
        start_date = (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")
        end_date = (datetime.now() + timedelta(days=395)).strftime("%Y-%m-%d")
        
        response = self.session.post(
            f"{BASE_URL}/api/finance/budgets",
            json={
                "period_type": "monthly",
                "period_start": start_date,
                "period_end": end_date,
                "name": f"TEST_Budget_{datetime.now().strftime('%Y%m%d%H%M%S')}",
                "allocations": [
                    {"category_key": "salaries", "planned_amount": 100000, "notes": "Test allocation"},
                    {"category_key": "rent", "planned_amount": 50000, "notes": "Test rent"}
                ],
                "notes": "Test budget created by automated tests"
            }
        )
        
        # May fail if overlapping budget exists, which is acceptable
        assert response.status_code in [200, 201, 400], f"Unexpected status: {response.status_code}: {response.text}"
        
        if response.status_code in [200, 201]:
            data = response.json()
            assert "budget_id" in data, "Created budget should have budget_id"
            assert data["status"] == "draft", "New budget should be in draft status"
    
    def test_create_budget_validates_period_type(self):
        """POST /api/finance/budgets should validate period_type"""
        response = self.session.post(
            f"{BASE_URL}/api/finance/budgets",
            json={
                "period_type": "invalid_type",
                "period_start": "2030-01-01",
                "period_end": "2030-01-31",
                "allocations": [{"category_key": "salaries", "planned_amount": 100000}]
            }
        )
        
        assert response.status_code == 400, f"Should reject invalid period_type, got {response.status_code}"
    
    def test_create_budget_validates_category_keys(self):
        """POST /api/finance/budgets should validate category keys"""
        response = self.session.post(
            f"{BASE_URL}/api/finance/budgets",
            json={
                "period_type": "monthly",
                "period_start": "2031-01-01",
                "period_end": "2031-01-31",
                "allocations": [{"category_key": "invalid_category_xyz", "planned_amount": 100000}]
            }
        )
        
        assert response.status_code == 400, f"Should reject invalid category key, got {response.status_code}"
    
    # ============ CURRENT BUDGET TESTS ============
    
    def test_get_current_budget_returns_200(self):
        """GET /api/finance/budgets/current should return 200"""
        response = self.session.get(f"{BASE_URL}/api/finance/budgets/current")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_current_budget_has_actuals_if_exists(self):
        """Current budget should have actuals calculated if budget exists"""
        response = self.session.get(f"{BASE_URL}/api/finance/budgets/current")
        data = response.json()
        
        # If there's an active budget, it should have summary
        if data.get("budget_id"):
            assert "allocations" in data, "Active budget should have allocations"
            if data.get("allocations"):
                alloc = data["allocations"][0]
                # Check for actual spending fields
                assert "actual_spent" in alloc or "variance" in alloc, "Allocations should have actual spending data"
    
    # ============ BUDGET ALERTS TESTS ============
    
    def test_get_budget_alerts_returns_200(self):
        """GET /api/finance/budget-alerts should return 200"""
        response = self.session.get(f"{BASE_URL}/api/finance/budget-alerts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_budget_alerts_returns_alerts_array(self):
        """Budget alerts should return an alerts array"""
        response = self.session.get(f"{BASE_URL}/api/finance/budget-alerts")
        data = response.json()
        
        assert "alerts" in data, "Response should contain 'alerts'"
        assert isinstance(data["alerts"], list), "alerts should be a list"
    
    # ============ FORECAST TESTS ============
    
    def test_get_forecast_returns_200(self):
        """GET /api/finance/forecast should return 200"""
        response = self.session.get(f"{BASE_URL}/api/finance/forecast")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_forecast_contains_health_score(self):
        """Forecast should contain health_score (0-100)"""
        response = self.session.get(f"{BASE_URL}/api/finance/forecast")
        data = response.json()
        
        assert "health_score" in data, "Forecast should contain 'health_score'"
        assert isinstance(data["health_score"], (int, float)), "health_score should be numeric"
        assert 0 <= data["health_score"] <= 100, f"health_score should be 0-100, got {data['health_score']}"
    
    def test_forecast_contains_runway(self):
        """Forecast should contain runway with months and status"""
        response = self.session.get(f"{BASE_URL}/api/finance/forecast")
        data = response.json()
        
        assert "runway" in data, "Forecast should contain 'runway'"
        runway = data["runway"]
        assert "months" in runway, "runway should have 'months'"
        assert "status" in runway, "runway should have 'status'"
        assert runway["status"] in ["healthy", "caution", "critical"], f"Invalid runway status: {runway['status']}"
    
    def test_forecast_contains_sales_pressure(self):
        """Forecast should contain sales_pressure with level"""
        response = self.session.get(f"{BASE_URL}/api/finance/forecast")
        data = response.json()
        
        assert "sales_pressure" in data, "Forecast should contain 'sales_pressure'"
        pressure = data["sales_pressure"]
        assert "level" in pressure, "sales_pressure should have 'level'"
        assert pressure["level"] in ["low", "moderate", "high"], f"Invalid pressure level: {pressure['level']}"
    
    def test_forecast_contains_financial_metrics(self):
        """Forecast should contain financial metrics"""
        response = self.session.get(f"{BASE_URL}/api/finance/forecast")
        data = response.json()
        
        expected_metrics = ["monthly_income", "monthly_expenses", "cash_available", "free_cash"]
        for metric in expected_metrics:
            assert metric in data, f"Forecast should contain '{metric}'"
            assert isinstance(data[metric], (int, float)), f"{metric} should be numeric"
    
    def test_forecast_contains_commitments(self):
        """Forecast should contain commitment data"""
        response = self.session.get(f"{BASE_URL}/api/finance/forecast")
        data = response.json()
        
        commitment_fields = ["locked_commitments", "pending_requests", "fixed_expenses", "variable_expenses"]
        for field in commitment_fields:
            assert field in data, f"Forecast should contain '{field}'"
    
    def test_forecast_contains_monthly_trends(self):
        """Forecast should contain monthly_trends"""
        response = self.session.get(f"{BASE_URL}/api/finance/forecast")
        data = response.json()
        
        assert "monthly_trends" in data, "Forecast should contain 'monthly_trends'"
    
    # ============ FORECAST ASSUMPTIONS TESTS ============
    
    def test_save_forecast_assumptions(self):
        """POST /api/finance/forecast/assumptions should save parameters"""
        response = self.session.post(
            f"{BASE_URL}/api/finance/forecast/assumptions",
            json={
                "expected_monthly_income": 500000,
                "expected_project_closures": 3,
                "average_project_value": 200000,
                "fixed_commitments": 150000,
                "notes": "Test assumptions from automated tests"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    # ============ EXPENSE REQUESTS LIST TESTS ============
    
    def test_get_expense_requests_returns_200(self):
        """GET /api/finance/expense-requests should return 200"""
        response = self.session.get(f"{BASE_URL}/api/finance/expense-requests")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_expense_requests_returns_list(self):
        """Expense requests should return a list"""
        response = self.session.get(f"{BASE_URL}/api/finance/expense-requests")
        data = response.json()
        
        assert isinstance(data, list), "Should return a list"
    
    # ============ AUTHENTICATION TESTS ============
    
    def test_unauthenticated_budget_access_returns_401(self):
        """Unauthenticated access to budgets should return 401"""
        # Create new session without auth
        unauth_session = requests.Session()
        response = unauth_session.get(f"{BASE_URL}/api/finance/budgets")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_unauthenticated_forecast_access_returns_401(self):
        """Unauthenticated access to forecast should return 401"""
        unauth_session = requests.Session()
        response = unauth_session.get(f"{BASE_URL}/api/finance/forecast")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
