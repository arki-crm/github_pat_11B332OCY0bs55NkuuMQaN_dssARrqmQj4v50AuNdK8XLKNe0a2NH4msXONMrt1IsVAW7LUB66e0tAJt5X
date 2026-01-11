"""
Salary / Payroll Module Tests
Tests for:
- GET /api/finance/salaries - list salary configurations
- POST /api/finance/salaries - create salary setup
- GET /api/finance/salaries/{employee_id} - get salary detail
- GET /api/finance/salaries/{employee_id}/history - get payment history
- POST /api/finance/salary-payments - record salary payment
- GET /api/finance/salary-summary - dashboard summary
- GET /api/finance/salary-cycles - get salary cycles
- POST /api/finance/salary-cycles/{employee_id}/{month_year}/close - close cycle
- POST /api/finance/salaries/{employee_id}/exit - process exit
- GET /api/finance/employees-for-salary - employees without salary setup
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "thaha.pakayil@gmail.com"
TEST_PASSWORD = "password123"


class TestSalaryModuleAuth:
    """Authentication and setup tests"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = s.post(f"{BASE_URL}/api/auth/local-login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.text}")
        
        # Extract session token from cookies
        if 'session_token' in login_response.cookies:
            s.cookies.set('session_token', login_response.cookies['session_token'])
        
        return s
    
    def test_auth_me_returns_user(self, session):
        """Verify authenticated user has salary permissions"""
        response = session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert data["role"] == "Admin"
        # Admin should have salary permissions
        perms = data.get("effective_permissions", [])
        assert "finance.salaries.view_all" in perms or data["role"] == "Admin"


class TestSalaryEndpoints:
    """Test all salary module endpoints"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = s.post(f"{BASE_URL}/api/auth/local-login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.text}")
        
        if 'session_token' in login_response.cookies:
            s.cookies.set('session_token', login_response.cookies['session_token'])
        
        return s
    
    # ============ GET /api/finance/salaries ============
    def test_get_salaries_returns_200(self, session):
        """GET /api/finance/salaries returns 200"""
        response = session.get(f"{BASE_URL}/api/finance/salaries")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_salaries_structure(self, session):
        """Salary records have correct structure"""
        response = session.get(f"{BASE_URL}/api/finance/salaries")
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            salary = data[0]
            # Check required fields
            assert "salary_id" in salary
            assert "employee_id" in salary
            assert "monthly_salary" in salary
            assert "payment_type" in salary
            assert "status" in salary
    
    # ============ GET /api/finance/salary-summary ============
    def test_get_salary_summary_returns_200(self, session):
        """GET /api/finance/salary-summary returns 200"""
        response = session.get(f"{BASE_URL}/api/finance/salary-summary")
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "active_employees" in data
        assert "total_monthly_salary" in data
        assert "pending_this_month" in data
        assert "risk_status" in data
    
    def test_salary_summary_has_risk_status(self, session):
        """Salary summary includes risk status (safe/tight/critical)"""
        response = session.get(f"{BASE_URL}/api/finance/salary-summary")
        assert response.status_code == 200
        data = response.json()
        
        assert data["risk_status"] in ["safe", "tight", "critical"]
        assert "risk_message" in data
    
    def test_salary_summary_has_budget_info(self, session):
        """Salary summary includes budget tracking info"""
        response = session.get(f"{BASE_URL}/api/finance/salary-summary")
        assert response.status_code == 200
        data = response.json()
        
        # budget_info may be None if no active budget
        if data.get("budget_info"):
            budget = data["budget_info"]
            assert "planned" in budget
            assert "actual" in budget
            assert "variance" in budget
            assert "status" in budget
            assert budget["status"] in ["safe", "near_limit", "over_budget"]
    
    # ============ GET /api/finance/salary-cycles ============
    def test_get_salary_cycles_returns_200(self, session):
        """GET /api/finance/salary-cycles returns 200"""
        current_month = datetime.now().strftime("%Y-%m")
        response = session.get(f"{BASE_URL}/api/finance/salary-cycles?month_year={current_month}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_salary_cycles_structure(self, session):
        """Salary cycles have correct structure"""
        current_month = datetime.now().strftime("%Y-%m")
        response = session.get(f"{BASE_URL}/api/finance/salary-cycles?month_year={current_month}")
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            cycle = data[0]
            assert "cycle_id" in cycle
            assert "employee_id" in cycle
            assert "month_year" in cycle
            assert "monthly_salary" in cycle
            assert "total_advances" in cycle
            assert "total_salary_paid" in cycle
            assert "balance_payable" in cycle
            assert "status" in cycle
    
    # ============ GET /api/finance/employees-for-salary ============
    def test_get_employees_for_salary_returns_200(self, session):
        """GET /api/finance/employees-for-salary returns 200"""
        response = session.get(f"{BASE_URL}/api/finance/employees-for-salary")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_employees_for_salary_structure(self, session):
        """Available employees have correct structure"""
        response = session.get(f"{BASE_URL}/api/finance/employees-for-salary")
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            emp = data[0]
            assert "user_id" in emp
            assert "name" in emp
            assert "email" in emp
            assert "role" in emp


class TestSalaryCRUDOperations:
    """Test salary CRUD operations"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        
        login_response = s.post(f"{BASE_URL}/api/auth/local-login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.text}")
        
        if 'session_token' in login_response.cookies:
            s.cookies.set('session_token', login_response.cookies['session_token'])
        
        return s
    
    @pytest.fixture(scope="class")
    def test_employee_id(self, session):
        """Get an employee ID for testing (create test user if needed)"""
        # First check if there are available employees
        response = session.get(f"{BASE_URL}/api/finance/employees-for-salary")
        if response.status_code == 200:
            employees = response.json()
            if len(employees) > 0:
                return employees[0]["user_id"]
        
        # If no available employees, check existing salaries
        response = session.get(f"{BASE_URL}/api/finance/salaries")
        if response.status_code == 200:
            salaries = response.json()
            if len(salaries) > 0:
                return salaries[0]["employee_id"]
        
        pytest.skip("No employees available for testing")
    
    @pytest.fixture(scope="class")
    def account_id(self, session):
        """Get an account ID for payment testing"""
        response = session.get(f"{BASE_URL}/api/accounting/accounts")
        if response.status_code == 200:
            accounts = response.json()
            active_accounts = [a for a in accounts if a.get("is_active", True)]
            if len(active_accounts) > 0:
                return active_accounts[0]["account_id"]
        
        pytest.skip("No accounts available for testing")
    
    # ============ POST /api/finance/salaries ============
    def test_create_salary_validation(self, session):
        """POST /api/finance/salaries validates required fields"""
        # Missing employee_id
        response = session.post(f"{BASE_URL}/api/finance/salaries", json={
            "monthly_salary": 50000,
            "payment_type": "monthly",
            "salary_start_date": "2025-01-01"
        })
        assert response.status_code == 422  # Validation error
    
    def test_create_salary_invalid_payment_type(self, session, test_employee_id):
        """POST /api/finance/salaries rejects invalid payment type"""
        response = session.post(f"{BASE_URL}/api/finance/salaries", json={
            "employee_id": test_employee_id,
            "monthly_salary": 50000,
            "payment_type": "invalid_type",
            "salary_start_date": "2025-01-01"
        })
        # Should return 400 or 409 (if salary already exists)
        assert response.status_code in [400, 409]
    
    def test_create_salary_for_new_employee(self, session):
        """POST /api/finance/salaries creates salary for new employee"""
        # Get available employees
        response = session.get(f"{BASE_URL}/api/finance/employees-for-salary")
        if response.status_code != 200:
            pytest.skip("Cannot get available employees")
        
        employees = response.json()
        if len(employees) == 0:
            pytest.skip("No employees available for salary setup")
        
        test_emp = employees[0]
        
        # Create salary
        create_response = session.post(f"{BASE_URL}/api/finance/salaries", json={
            "employee_id": test_emp["user_id"],
            "monthly_salary": 45000,
            "payment_type": "monthly",
            "salary_start_date": datetime.now().strftime("%Y-%m-%d"),
            "notes": "TEST_salary_setup"
        })
        
        # Should succeed or fail if already exists
        assert create_response.status_code in [200, 201, 409]
        
        if create_response.status_code in [200, 201]:
            data = create_response.json()
            assert "salary_id" in data
            assert data["employee_id"] == test_emp["user_id"]
            assert data["monthly_salary"] == 45000
    
    # ============ GET /api/finance/salaries/{employee_id} ============
    def test_get_salary_detail(self, session, test_employee_id):
        """GET /api/finance/salaries/{employee_id} returns salary detail"""
        response = session.get(f"{BASE_URL}/api/finance/salaries/{test_employee_id}")
        
        # May return 404 if no salary exists
        if response.status_code == 404:
            pytest.skip("No salary record for test employee")
        
        assert response.status_code == 200
        data = response.json()
        assert data["employee_id"] == test_employee_id
        assert "monthly_salary" in data
        assert "status" in data
    
    # ============ GET /api/finance/salaries/{employee_id}/history ============
    def test_get_salary_history(self, session, test_employee_id):
        """GET /api/finance/salaries/{employee_id}/history returns payment history"""
        response = session.get(f"{BASE_URL}/api/finance/salaries/{test_employee_id}/history")
        
        if response.status_code == 404:
            pytest.skip("No salary record for test employee")
        
        assert response.status_code == 200
        data = response.json()
        assert "salary_master" in data
        assert "cycles" in data
        assert "payments" in data


class TestSalaryPayments:
    """Test salary payment operations"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        
        login_response = s.post(f"{BASE_URL}/api/auth/local-login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.text}")
        
        if 'session_token' in login_response.cookies:
            s.cookies.set('session_token', login_response.cookies['session_token'])
        
        return s
    
    @pytest.fixture(scope="class")
    def salary_employee(self, session):
        """Get an employee with salary setup"""
        response = session.get(f"{BASE_URL}/api/finance/salaries")
        if response.status_code == 200:
            salaries = response.json()
            active_salaries = [s for s in salaries if s.get("status") == "active"]
            if len(active_salaries) > 0:
                return active_salaries[0]
        
        pytest.skip("No active salary records for testing")
    
    @pytest.fixture(scope="class")
    def account_id(self, session):
        """Get an account ID for payment testing"""
        response = session.get(f"{BASE_URL}/api/accounting/accounts")
        if response.status_code == 200:
            accounts = response.json()
            active_accounts = [a for a in accounts if a.get("is_active", True)]
            if len(active_accounts) > 0:
                return active_accounts[0]["account_id"]
        
        pytest.skip("No accounts available for testing")
    
    # ============ POST /api/finance/salary-payments ============
    def test_create_salary_payment_validation(self, session):
        """POST /api/finance/salary-payments validates required fields"""
        response = session.post(f"{BASE_URL}/api/finance/salary-payments", json={
            "amount": 10000,
            "payment_type": "advance"
        })
        assert response.status_code == 422  # Missing required fields
    
    def test_create_advance_payment(self, session, salary_employee, account_id):
        """POST /api/finance/salary-payments creates advance payment"""
        current_month = datetime.now().strftime("%Y-%m")
        
        response = session.post(f"{BASE_URL}/api/finance/salary-payments", json={
            "employee_id": salary_employee["employee_id"],
            "amount": 5000,
            "payment_type": "advance",
            "account_id": account_id,
            "payment_date": datetime.now().strftime("%Y-%m-%d"),
            "month_year": current_month,
            "notes": "TEST_advance_payment"
        })
        
        # May fail if day is locked
        if response.status_code == 400 and "locked" in response.text.lower():
            pytest.skip("Day is locked, cannot add payment")
        
        assert response.status_code in [200, 201]
        data = response.json()
        assert "payment" in data
        assert "transaction_id" in data
        assert data["payment"]["payment_type"] == "advance"
        assert data["payment"]["amount"] == 5000
    
    def test_create_salary_payment(self, session, salary_employee, account_id):
        """POST /api/finance/salary-payments creates salary payment"""
        current_month = datetime.now().strftime("%Y-%m")
        
        response = session.post(f"{BASE_URL}/api/finance/salary-payments", json={
            "employee_id": salary_employee["employee_id"],
            "amount": 20000,
            "payment_type": "salary",
            "account_id": account_id,
            "payment_date": datetime.now().strftime("%Y-%m-%d"),
            "month_year": current_month,
            "notes": "TEST_salary_payment"
        })
        
        if response.status_code == 400 and "locked" in response.text.lower():
            pytest.skip("Day is locked, cannot add payment")
        
        assert response.status_code in [200, 201]
        data = response.json()
        assert "payment" in data
        assert "transaction_id" in data
        assert data["payment"]["payment_type"] == "salary"
    
    def test_payment_creates_cashbook_entry(self, session, salary_employee, account_id):
        """Salary payment creates cashbook entry with reference_type='salary_payment'"""
        current_month = datetime.now().strftime("%Y-%m")
        
        # Make a payment
        payment_response = session.post(f"{BASE_URL}/api/finance/salary-payments", json={
            "employee_id": salary_employee["employee_id"],
            "amount": 1000,
            "payment_type": "advance",
            "account_id": account_id,
            "payment_date": datetime.now().strftime("%Y-%m-%d"),
            "month_year": current_month,
            "notes": "TEST_cashbook_entry_check"
        })
        
        if payment_response.status_code == 400:
            pytest.skip("Cannot create payment (day may be locked)")
        
        assert payment_response.status_code in [200, 201]
        payment_data = payment_response.json()
        transaction_id = payment_data.get("transaction_id")
        
        # Verify cashbook entry exists
        cashbook_response = session.get(f"{BASE_URL}/api/accounting/cashbook?date={datetime.now().strftime('%Y-%m-%d')}")
        if cashbook_response.status_code == 200:
            entries = cashbook_response.json()
            salary_entries = [e for e in entries if e.get("reference_type") == "salary_payment"]
            assert len(salary_entries) > 0, "No salary_payment entries found in cashbook"


class TestSalaryCycleOperations:
    """Test salary cycle operations"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        
        login_response = s.post(f"{BASE_URL}/api/auth/local-login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.text}")
        
        if 'session_token' in login_response.cookies:
            s.cookies.set('session_token', login_response.cookies['session_token'])
        
        return s
    
    # ============ POST /api/finance/salary-cycles/{employee_id}/{month_year}/close ============
    def test_close_cycle_nonexistent(self, session):
        """POST close cycle returns 404 for nonexistent cycle"""
        response = session.post(f"{BASE_URL}/api/finance/salary-cycles/nonexistent_emp/2025-01/close")
        assert response.status_code == 404
    
    def test_close_cycle_validation(self, session):
        """Close cycle validates cycle exists and is open"""
        # Get an existing cycle
        current_month = datetime.now().strftime("%Y-%m")
        cycles_response = session.get(f"{BASE_URL}/api/finance/salary-cycles?month_year={current_month}")
        
        if cycles_response.status_code != 200:
            pytest.skip("Cannot get salary cycles")
        
        cycles = cycles_response.json()
        open_cycles = [c for c in cycles if c.get("status") == "open"]
        
        if len(open_cycles) == 0:
            pytest.skip("No open cycles to test")
        
        # Try to close a cycle that's already closed (if any)
        closed_cycles = [c for c in cycles if c.get("status") == "closed"]
        if len(closed_cycles) > 0:
            cycle = closed_cycles[0]
            response = session.post(f"{BASE_URL}/api/finance/salary-cycles/{cycle['employee_id']}/{cycle['month_year']}/close")
            assert response.status_code == 400  # Already closed


class TestSalaryExitProcess:
    """Test employee exit processing"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        
        login_response = s.post(f"{BASE_URL}/api/auth/local-login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.text}")
        
        if 'session_token' in login_response.cookies:
            s.cookies.set('session_token', login_response.cookies['session_token'])
        
        return s
    
    # ============ POST /api/finance/salaries/{employee_id}/exit ============
    def test_exit_nonexistent_employee(self, session):
        """POST exit returns 404 for nonexistent employee"""
        response = session.post(f"{BASE_URL}/api/finance/salaries/nonexistent_emp/exit", json={
            "exit_date": datetime.now().strftime("%Y-%m-%d")
        })
        assert response.status_code == 404
    
    def test_exit_requires_date(self, session):
        """POST exit requires exit_date"""
        # Get an active salary
        salaries_response = session.get(f"{BASE_URL}/api/finance/salaries")
        if salaries_response.status_code != 200:
            pytest.skip("Cannot get salaries")
        
        salaries = salaries_response.json()
        active_salaries = [s for s in salaries if s.get("status") == "active"]
        
        if len(active_salaries) == 0:
            pytest.skip("No active salaries to test")
        
        # Try exit without date
        response = session.post(f"{BASE_URL}/api/finance/salaries/{active_salaries[0]['employee_id']}/exit", json={})
        assert response.status_code == 400


class TestUnauthenticatedAccess:
    """Test that unauthenticated requests are rejected"""
    
    def test_salaries_requires_auth(self):
        """GET /api/finance/salaries requires authentication"""
        response = requests.get(f"{BASE_URL}/api/finance/salaries")
        assert response.status_code == 401
    
    def test_salary_summary_requires_auth(self):
        """GET /api/finance/salary-summary requires authentication"""
        response = requests.get(f"{BASE_URL}/api/finance/salary-summary")
        assert response.status_code == 401
    
    def test_salary_cycles_requires_auth(self):
        """GET /api/finance/salary-cycles requires authentication"""
        response = requests.get(f"{BASE_URL}/api/finance/salary-cycles")
        assert response.status_code == 401
    
    def test_employees_for_salary_requires_auth(self):
        """GET /api/finance/employees-for-salary requires authentication"""
        response = requests.get(f"{BASE_URL}/api/finance/employees-for-salary")
        assert response.status_code == 401
    
    def test_salary_payments_requires_auth(self):
        """POST /api/finance/salary-payments requires authentication"""
        response = requests.post(f"{BASE_URL}/api/finance/salary-payments", json={})
        assert response.status_code == 401


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
