"""
Test Suite for Salary Ladder Configuration and Promotion Eligibility Features
Tests the new enhancement to the Salary module:
1. Salary Ladder Configuration (Admin editable)
2. Edit Salary/Promote with history tracking
3. Salary Change History (audit trail)
4. Promotion Eligibility Flagging (non-automated, visibility only)
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://budget-control-57.preview.emergentagent.com')


class TestSalaryLadderConfiguration:
    """Tests for GET/PUT /api/finance/salary-ladder"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with authentication"""
        self.session = requests.Session()
        # Login to get session
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": "thaha.pakayil@gmail.com", "password": "password123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.user = login_response.json().get("user", {})
    
    def test_get_salary_ladder_returns_default_or_configured(self):
        """GET /api/finance/salary-ladder - returns default or configured salary levels"""
        response = self.session.get(f"{BASE_URL}/api/finance/salary-ladder")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Salary ladder should be a list"
        
        # Verify structure of each level
        if len(data) > 0:
            level = data[0]
            assert "level" in level, "Level should have 'level' field"
            assert "name" in level, "Level should have 'name' field"
            assert "min_salary" in level, "Level should have 'min_salary' field"
            assert "max_salary" in level, "Level should have 'max_salary' field"
            assert "order" in level, "Level should have 'order' field"
        
        print(f"✓ GET /api/finance/salary-ladder returned {len(data)} levels")
    
    def test_update_salary_ladder_configuration(self):
        """PUT /api/finance/salary-ladder - updates salary ladder configuration"""
        # First get current ladder
        get_response = self.session.get(f"{BASE_URL}/api/finance/salary-ladder")
        assert get_response.status_code == 200
        original_ladder = get_response.json()
        
        # Update with test data
        test_ladder = {
            "levels": [
                {"level": "trainee", "name": "Trainee", "min_salary": 3500, "max_salary": 5500, "order": 0},
                {"level": "level_1", "name": "Level 1", "min_salary": 7500, "max_salary": 7500, "order": 1},
                {"level": "level_2", "name": "Level 2", "min_salary": 10500, "max_salary": 10500, "order": 2},
                {"level": "level_3", "name": "Level 3", "min_salary": 13500, "max_salary": 13500, "order": 3},
                {"level": "level_4", "name": "Level 4 (Cap)", "min_salary": 16000, "max_salary": 16000, "order": 4}
            ]
        }
        
        response = self.session.put(
            f"{BASE_URL}/api/finance/salary-ladder",
            json=test_ladder
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Update should return success=True"
        assert "levels" in data, "Response should contain levels"
        
        # Verify the update persisted
        verify_response = self.session.get(f"{BASE_URL}/api/finance/salary-ladder")
        assert verify_response.status_code == 200
        updated_ladder = verify_response.json()
        
        # Check that at least one value changed
        assert updated_ladder[0]["min_salary"] == 3500, "Trainee min_salary should be updated to 3500"
        
        print(f"✓ PUT /api/finance/salary-ladder successfully updated configuration")
        
        # Restore original ladder
        restore_response = self.session.put(
            f"{BASE_URL}/api/finance/salary-ladder",
            json={"levels": original_ladder}
        )
        assert restore_response.status_code == 200, "Failed to restore original ladder"
    
    def test_salary_ladder_unauthenticated_access(self):
        """Unauthenticated access to salary ladder should return 401"""
        unauthenticated_session = requests.Session()
        response = unauthenticated_session.get(f"{BASE_URL}/api/finance/salary-ladder")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Unauthenticated access to salary ladder returns 401")


class TestSalaryPromoteWithHistory:
    """Tests for POST /api/finance/salaries/{employee_id}/promote"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with authentication"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": "thaha.pakayil@gmail.com", "password": "password123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.user = login_response.json().get("user", {})
    
    def test_promote_employee_salary_with_history(self):
        """POST /api/finance/salaries/{employee_id}/promote - changes salary with history tracking"""
        # First get list of salaries to find an employee
        salaries_response = self.session.get(f"{BASE_URL}/api/finance/salaries")
        assert salaries_response.status_code == 200
        salaries = salaries_response.json()
        
        if len(salaries) == 0:
            pytest.skip("No salary records found to test promotion")
        
        # Find an active employee
        active_salary = None
        for salary in salaries:
            if salary.get("status") == "active":
                active_salary = salary
                break
        
        if not active_salary:
            pytest.skip("No active salary records found")
        
        employee_id = active_salary["employee_id"]
        original_salary = active_salary["monthly_salary"]
        
        # Promote with a small increase
        promote_data = {
            "new_salary": original_salary + 1000,
            "new_level": "TEST_Level",
            "effective_date": datetime.now().strftime("%Y-%m-%d"),
            "reason": "promotion",
            "notes": "TEST_Promotion for testing purposes"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/finance/salaries/{employee_id}/promote",
            json=promote_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Promote should return success=True"
        assert "history" in data, "Response should contain history record"
        assert "message" in data, "Response should contain message"
        
        # Verify history record structure
        history = data["history"]
        assert history["employee_id"] == employee_id
        assert history["previous_salary"] == original_salary
        assert history["new_salary"] == original_salary + 1000
        assert history["reason"] == "promotion"
        
        print(f"✓ POST /api/finance/salaries/{employee_id}/promote created history record")
        
        # Restore original salary
        restore_data = {
            "new_salary": original_salary,
            "new_level": active_salary.get("salary_level", ""),
            "effective_date": datetime.now().strftime("%Y-%m-%d"),
            "reason": "correction",
            "notes": "TEST_Restoring original salary after test"
        }
        restore_response = self.session.post(
            f"{BASE_URL}/api/finance/salaries/{employee_id}/promote",
            json=restore_data
        )
        assert restore_response.status_code == 200, "Failed to restore original salary"
    
    def test_promote_with_invalid_reason(self):
        """Promote with invalid reason should return 400"""
        salaries_response = self.session.get(f"{BASE_URL}/api/finance/salaries")
        salaries = salaries_response.json()
        
        if len(salaries) == 0:
            pytest.skip("No salary records found")
        
        employee_id = salaries[0]["employee_id"]
        
        promote_data = {
            "new_salary": 50000,
            "effective_date": datetime.now().strftime("%Y-%m-%d"),
            "reason": "invalid_reason",  # Invalid
            "notes": "TEST"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/finance/salaries/{employee_id}/promote",
            json=promote_data
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Promote with invalid reason returns 400")
    
    def test_promote_nonexistent_employee(self):
        """Promote nonexistent employee should return 404"""
        promote_data = {
            "new_salary": 50000,
            "effective_date": datetime.now().strftime("%Y-%m-%d"),
            "reason": "promotion",
            "notes": "TEST"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/finance/salaries/nonexistent_employee_id/promote",
            json=promote_data
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Promote nonexistent employee returns 404")


class TestSalaryChangeHistory:
    """Tests for GET /api/finance/salaries/{employee_id}/salary-history"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with authentication"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": "thaha.pakayil@gmail.com", "password": "password123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.user = login_response.json().get("user", {})
    
    def test_get_salary_history_returns_audit_trail(self):
        """GET /api/finance/salaries/{employee_id}/salary-history - returns salary change audit trail"""
        # Get list of salaries
        salaries_response = self.session.get(f"{BASE_URL}/api/finance/salaries")
        assert salaries_response.status_code == 200
        salaries = salaries_response.json()
        
        if len(salaries) == 0:
            pytest.skip("No salary records found")
        
        employee_id = salaries[0]["employee_id"]
        
        response = self.session.get(f"{BASE_URL}/api/finance/salaries/{employee_id}/salary-history")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Salary history should be a list"
        
        # If there's history, verify structure
        if len(data) > 0:
            history_record = data[0]
            assert "history_id" in history_record, "History should have history_id"
            assert "employee_id" in history_record, "History should have employee_id"
            assert "previous_salary" in history_record, "History should have previous_salary"
            assert "new_salary" in history_record, "History should have new_salary"
            assert "reason" in history_record, "History should have reason"
            assert "changed_at" in history_record, "History should have changed_at"
            assert "changed_by_name" in history_record, "History should have changed_by_name"
        
        print(f"✓ GET /api/finance/salaries/{employee_id}/salary-history returned {len(data)} records")
    
    def test_salary_history_unauthenticated(self):
        """Unauthenticated access to salary history should return 401"""
        unauthenticated_session = requests.Session()
        response = unauthenticated_session.get(f"{BASE_URL}/api/finance/salaries/some_id/salary-history")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Unauthenticated access to salary history returns 401")


class TestPromotionEligibilityConfig:
    """Tests for GET/PUT /api/hr/promotion-config"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with authentication"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": "thaha.pakayil@gmail.com", "password": "password123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.user = login_response.json().get("user", {})
    
    def test_get_promotion_config_returns_thresholds(self):
        """GET /api/hr/promotion-config - returns eligibility thresholds"""
        response = self.session.get(f"{BASE_URL}/api/hr/promotion-config")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "credits_required" in data, "Config should have credits_required"
        assert "months_required" in data, "Config should have months_required"
        assert "stagnant_months" in data, "Config should have stagnant_months"
        
        # Verify values are integers
        assert isinstance(data["credits_required"], int), "credits_required should be int"
        assert isinstance(data["months_required"], int), "months_required should be int"
        assert isinstance(data["stagnant_months"], int), "stagnant_months should be int"
        
        print(f"✓ GET /api/hr/promotion-config returned config: credits={data['credits_required']}, months={data['months_required']}, stagnant={data['stagnant_months']}")
    
    def test_update_promotion_config(self):
        """PUT /api/hr/promotion-config - updates eligibility configuration"""
        # Get current config
        get_response = self.session.get(f"{BASE_URL}/api/hr/promotion-config")
        assert get_response.status_code == 200
        original_config = get_response.json()
        
        # Update with test values
        test_config = {
            "credits_required": 5,
            "months_required": 4,
            "stagnant_months": 8
        }
        
        response = self.session.put(
            f"{BASE_URL}/api/hr/promotion-config",
            json=test_config
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Update should return success=True"
        assert "config" in data, "Response should contain config"
        
        # Verify update persisted
        verify_response = self.session.get(f"{BASE_URL}/api/hr/promotion-config")
        assert verify_response.status_code == 200
        updated_config = verify_response.json()
        assert updated_config["credits_required"] == 5, "credits_required should be updated"
        
        print("✓ PUT /api/hr/promotion-config successfully updated configuration")
        
        # Restore original config
        restore_response = self.session.put(
            f"{BASE_URL}/api/hr/promotion-config",
            json={
                "credits_required": original_config.get("credits_required", 3),
                "months_required": original_config.get("months_required", 3),
                "stagnant_months": original_config.get("stagnant_months", 6)
            }
        )
        assert restore_response.status_code == 200, "Failed to restore original config"


class TestPromotionEligibilityOverview:
    """Tests for GET /api/hr/promotion-eligibility/overview"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with authentication"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": "thaha.pakayil@gmail.com", "password": "password123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.user = login_response.json().get("user", {})
    
    def test_get_promotion_eligibility_overview(self):
        """GET /api/hr/promotion-eligibility/overview - returns CEO overview with eligible/near/stagnant counts"""
        response = self.session.get(f"{BASE_URL}/api/hr/promotion-eligibility/overview")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "total_employees" in data, "Overview should have total_employees"
        assert "eligible_count" in data, "Overview should have eligible_count"
        assert "near_eligible_count" in data, "Overview should have near_eligible_count"
        assert "stagnant_count" in data, "Overview should have stagnant_count"
        assert "in_progress_count" in data, "Overview should have in_progress_count"
        assert "eligible" in data, "Overview should have eligible list"
        assert "near_eligible" in data, "Overview should have near_eligible list"
        assert "stagnant" in data, "Overview should have stagnant list"
        assert "config" in data, "Overview should have config"
        
        # Verify counts are integers
        assert isinstance(data["total_employees"], int)
        assert isinstance(data["eligible_count"], int)
        assert isinstance(data["near_eligible_count"], int)
        assert isinstance(data["stagnant_count"], int)
        assert isinstance(data["in_progress_count"], int)
        
        # Verify lists are lists
        assert isinstance(data["eligible"], list)
        assert isinstance(data["near_eligible"], list)
        assert isinstance(data["stagnant"], list)
        
        print(f"✓ GET /api/hr/promotion-eligibility/overview returned: total={data['total_employees']}, eligible={data['eligible_count']}, near={data['near_eligible_count']}, stagnant={data['stagnant_count']}")
    
    def test_promotion_eligibility_overview_unauthenticated(self):
        """Unauthenticated access to promotion overview should return 401"""
        unauthenticated_session = requests.Session()
        response = unauthenticated_session.get(f"{BASE_URL}/api/hr/promotion-eligibility/overview")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Unauthenticated access to promotion overview returns 401")


class TestEmployeePromotionEligibility:
    """Tests for GET /api/hr/promotion-eligibility/{employee_id}"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with authentication"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": "thaha.pakayil@gmail.com", "password": "password123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.user = login_response.json().get("user", {})
    
    def test_get_employee_promotion_eligibility(self):
        """GET /api/hr/promotion-eligibility/{employee_id} - returns specific employee eligibility"""
        # Get list of salaries to find an employee
        salaries_response = self.session.get(f"{BASE_URL}/api/finance/salaries")
        assert salaries_response.status_code == 200
        salaries = salaries_response.json()
        
        if len(salaries) == 0:
            pytest.skip("No salary records found")
        
        employee_id = salaries[0]["employee_id"]
        
        response = self.session.get(f"{BASE_URL}/api/hr/promotion-eligibility/{employee_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "employee_id" in data, "Eligibility should have employee_id"
        assert "employee_name" in data, "Eligibility should have employee_name"
        assert "current_salary" in data, "Eligibility should have current_salary"
        assert "months_at_current_level" in data, "Eligibility should have months_at_current_level"
        assert "booking_credits" in data, "Eligibility should have booking_credits"
        assert "eligibility_status" in data, "Eligibility should have eligibility_status"
        assert "eligibility_message" in data, "Eligibility should have eligibility_message"
        
        # Verify eligibility_status is valid
        valid_statuses = ["eligible", "near_eligible", "stagnant", "in_progress"]
        assert data["eligibility_status"] in valid_statuses, f"Invalid status: {data['eligibility_status']}"
        
        print(f"✓ GET /api/hr/promotion-eligibility/{employee_id} returned status: {data['eligibility_status']}")
    
    def test_get_nonexistent_employee_eligibility(self):
        """GET /api/hr/promotion-eligibility/{employee_id} for nonexistent employee returns 404"""
        response = self.session.get(f"{BASE_URL}/api/hr/promotion-eligibility/nonexistent_employee_id")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ GET promotion eligibility for nonexistent employee returns 404")


class TestAllPromotionEligibility:
    """Tests for GET /api/hr/promotion-eligibility"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with authentication"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": "thaha.pakayil@gmail.com", "password": "password123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.user = login_response.json().get("user", {})
    
    def test_get_all_promotion_eligibility(self):
        """GET /api/hr/promotion-eligibility - returns all employees eligibility"""
        response = self.session.get(f"{BASE_URL}/api/hr/promotion-eligibility")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # If there are employees, verify structure
        if len(data) > 0:
            emp = data[0]
            assert "employee_id" in emp
            assert "employee_name" in emp
            assert "eligibility_status" in emp
        
        print(f"✓ GET /api/hr/promotion-eligibility returned {len(data)} employees")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
