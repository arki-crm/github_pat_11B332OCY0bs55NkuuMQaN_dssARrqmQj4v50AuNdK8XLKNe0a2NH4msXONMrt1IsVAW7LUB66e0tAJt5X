"""
Execution Ledger Module Tests
Tests for the purely observational execution tracking module.
CRITICAL: Verifies that execution ledger does NOT affect accounting totals.
"""
import pytest
import requests
import os
import json
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://design-finance-2.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "thaha.pakayil@gmail.com"
TEST_PASSWORD = "password123"
TEST_PROJECT_ID = "proj_17942869"

# Expected categories
EXPECTED_CATEGORIES = [
    "Modular Material",
    "Hardware & Accessories",
    "Factory / Job Work",
    "Installation",
    "Transportation / Logistics",
    "Non-Modular Furniture",
    "Site Expense"
]


class TestExecutionLedgerBackend:
    """Backend API tests for Execution Ledger module"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session and authenticate"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        # Store session cookie
        self.session.cookies.update(login_response.cookies)
        
        yield
        
        # Cleanup: Delete test entries created during tests
        self._cleanup_test_entries()
    
    def _cleanup_test_entries(self):
        """Clean up test entries created during testing"""
        try:
            # Get all entries for test project
            response = self.session.get(f"{BASE_URL}/api/finance/execution-ledger/project/{TEST_PROJECT_ID}")
            if response.status_code == 200:
                entries = response.json().get("entries", [])
                for entry in entries:
                    if entry.get("material_name", "").startswith("TEST_"):
                        self.session.delete(f"{BASE_URL}/api/finance/execution-ledger/{entry['execution_id']}")
        except Exception as e:
            print(f"Cleanup warning: {e}")
    
    # ============ CATEGORIES ENDPOINT ============
    
    def test_get_categories_returns_7_categories(self):
        """GET /api/finance/execution-ledger/categories - returns list of 7 categories"""
        response = self.session.get(f"{BASE_URL}/api/finance/execution-ledger/categories")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "categories" in data, "Response should contain 'categories' key"
        categories = data["categories"]
        
        assert len(categories) == 7, f"Expected 7 categories, got {len(categories)}"
        
        # Verify all expected categories are present
        for expected_cat in EXPECTED_CATEGORIES:
            assert expected_cat in categories, f"Missing category: {expected_cat}"
        
        print(f"✓ Categories endpoint returns all 7 categories: {categories}")
    
    # ============ CREATE ENTRY ENDPOINT ============
    
    def test_create_execution_entry_success(self):
        """POST /api/finance/execution-ledger - create execution entry (Admin/ProjectManager only)"""
        payload = {
            "project_id": TEST_PROJECT_ID,
            "category": "Modular Material",
            "material_name": "TEST_BWP Plywood 18mm",
            "specification": "Marine Grade",
            "brand": "Century",
            "size_unit": "sq ft",
            "quantity": 100,
            "rate_per_unit": 150,
            "vendor": "Test Plywood Supplier",
            "execution_date": datetime.now().strftime("%Y-%m-%d"),
            "remarks": "Test entry for automated testing"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/finance/execution-ledger",
            json=payload
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("success") == True, "Response should indicate success"
        assert "entry" in data, "Response should contain 'entry'"
        
        entry = data["entry"]
        assert entry.get("execution_id"), "Entry should have execution_id"
        assert entry.get("material_name") == payload["material_name"]
        assert entry.get("category") == payload["category"]
        assert entry.get("quantity") == payload["quantity"]
        assert entry.get("rate_per_unit") == payload["rate_per_unit"]
        assert entry.get("total_value") == payload["quantity"] * payload["rate_per_unit"]
        
        print(f"✓ Created execution entry: {entry['execution_id']} with total value {entry['total_value']}")
        
        # Store for later tests
        self.created_entry_id = entry["execution_id"]
        return entry["execution_id"]
    
    def test_create_entry_invalid_category(self):
        """POST /api/finance/execution-ledger - invalid category returns 400"""
        payload = {
            "project_id": TEST_PROJECT_ID,
            "category": "Invalid Category",
            "material_name": "TEST_Invalid",
            "quantity": 10,
            "rate_per_unit": 100,
            "execution_date": datetime.now().strftime("%Y-%m-%d")
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/finance/execution-ledger",
            json=payload
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid category, got {response.status_code}"
        print("✓ Invalid category correctly rejected with 400")
    
    def test_create_entry_invalid_project(self):
        """POST /api/finance/execution-ledger - invalid project returns 404"""
        payload = {
            "project_id": "invalid_project_id",
            "category": "Modular Material",
            "material_name": "TEST_Invalid Project",
            "quantity": 10,
            "rate_per_unit": 100,
            "execution_date": datetime.now().strftime("%Y-%m-%d")
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/finance/execution-ledger",
            json=payload
        )
        
        assert response.status_code == 404, f"Expected 404 for invalid project, got {response.status_code}"
        print("✓ Invalid project correctly rejected with 404")
    
    # ============ GET PROJECT ENTRIES ENDPOINT ============
    
    def test_get_project_entries_with_summary(self):
        """GET /api/finance/execution-ledger/project/{project_id} - get all entries for project with summary"""
        response = self.session.get(f"{BASE_URL}/api/finance/execution-ledger/project/{TEST_PROJECT_ID}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "entries" in data, "Response should contain 'entries'"
        assert "count" in data, "Response should contain 'count'"
        assert "total_value" in data, "Response should contain 'total_value'"
        assert "summary_by_category" in data, "Response should contain 'summary_by_category'"
        
        print(f"✓ Project entries: {data['count']} entries, total value: {data['total_value']}")
        print(f"  Summary by category: {data['summary_by_category']}")
    
    def test_get_project_entries_with_category_filter(self):
        """GET /api/finance/execution-ledger/project/{project_id}?category=X - filter by category"""
        # First create an entry with specific category
        payload = {
            "project_id": TEST_PROJECT_ID,
            "category": "Hardware & Accessories",
            "material_name": "TEST_Hettich Hinges",
            "quantity": 50,
            "rate_per_unit": 200,
            "execution_date": datetime.now().strftime("%Y-%m-%d")
        }
        create_response = self.session.post(f"{BASE_URL}/api/finance/execution-ledger", json=payload)
        assert create_response.status_code == 200
        
        # Now filter by category
        response = self.session.get(
            f"{BASE_URL}/api/finance/execution-ledger/project/{TEST_PROJECT_ID}",
            params={"category": "Hardware & Accessories"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # All entries should be of the filtered category
        for entry in data.get("entries", []):
            assert entry.get("category") == "Hardware & Accessories", f"Entry has wrong category: {entry.get('category')}"
        
        print(f"✓ Category filter works: {data['count']} entries in 'Hardware & Accessories'")
    
    # ============ GET SINGLE ENTRY ENDPOINT ============
    
    def test_get_single_entry(self):
        """GET /api/finance/execution-ledger/{execution_id} - get single entry"""
        # First create an entry
        payload = {
            "project_id": TEST_PROJECT_ID,
            "category": "Installation",
            "material_name": "TEST_Kitchen Installation",
            "quantity": 1,
            "rate_per_unit": 25000,
            "execution_date": datetime.now().strftime("%Y-%m-%d")
        }
        create_response = self.session.post(f"{BASE_URL}/api/finance/execution-ledger", json=payload)
        assert create_response.status_code == 200
        entry_id = create_response.json()["entry"]["execution_id"]
        
        # Get single entry
        response = self.session.get(f"{BASE_URL}/api/finance/execution-ledger/{entry_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        entry = response.json()
        
        assert entry.get("execution_id") == entry_id
        assert entry.get("material_name") == payload["material_name"]
        assert entry.get("total_value") == payload["quantity"] * payload["rate_per_unit"]
        
        print(f"✓ Single entry retrieved: {entry_id}")
    
    def test_get_nonexistent_entry(self):
        """GET /api/finance/execution-ledger/{execution_id} - nonexistent entry returns 404"""
        response = self.session.get(f"{BASE_URL}/api/finance/execution-ledger/nonexistent_id")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Nonexistent entry correctly returns 404")
    
    # ============ UPDATE ENTRY ENDPOINT ============
    
    def test_update_execution_entry(self):
        """PUT /api/finance/execution-ledger/{execution_id} - update entry (Admin/ProjectManager only)"""
        # First create an entry
        payload = {
            "project_id": TEST_PROJECT_ID,
            "category": "Transportation / Logistics",
            "material_name": "TEST_Transport Charges",
            "quantity": 1,
            "rate_per_unit": 5000,
            "execution_date": datetime.now().strftime("%Y-%m-%d")
        }
        create_response = self.session.post(f"{BASE_URL}/api/finance/execution-ledger", json=payload)
        assert create_response.status_code == 200
        entry_id = create_response.json()["entry"]["execution_id"]
        
        # Update the entry
        update_payload = {
            "quantity": 2,
            "rate_per_unit": 6000,
            "remarks": "Updated during testing"
        }
        
        response = self.session.put(
            f"{BASE_URL}/api/finance/execution-ledger/{entry_id}",
            json=update_payload
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("success") == True
        updated_entry = data.get("entry")
        assert updated_entry.get("quantity") == 2
        assert updated_entry.get("rate_per_unit") == 6000
        assert updated_entry.get("total_value") == 12000  # 2 * 6000
        assert updated_entry.get("remarks") == "Updated during testing"
        
        print(f"✓ Entry updated: new total_value = {updated_entry['total_value']}")
    
    # ============ DELETE ENTRY ENDPOINT ============
    
    def test_delete_execution_entry_admin_only(self):
        """DELETE /api/finance/execution-ledger/{execution_id} - delete entry (Admin only)"""
        # First create an entry
        payload = {
            "project_id": TEST_PROJECT_ID,
            "category": "Site Expense",
            "material_name": "TEST_Site Cleaning",
            "quantity": 1,
            "rate_per_unit": 2000,
            "execution_date": datetime.now().strftime("%Y-%m-%d")
        }
        create_response = self.session.post(f"{BASE_URL}/api/finance/execution-ledger", json=payload)
        assert create_response.status_code == 200
        entry_id = create_response.json()["entry"]["execution_id"]
        
        # Delete the entry (Admin should be able to)
        response = self.session.delete(f"{BASE_URL}/api/finance/execution-ledger/{entry_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True
        
        # Verify entry is deleted
        get_response = self.session.get(f"{BASE_URL}/api/finance/execution-ledger/{entry_id}")
        assert get_response.status_code == 404, "Deleted entry should return 404"
        
        print(f"✓ Entry deleted successfully: {entry_id}")
    
    # ============ EXPORT ENDPOINTS ============
    
    def test_export_csv(self):
        """GET /api/finance/execution-ledger/export/{project_id}?format=csv - export as CSV"""
        # First ensure there's at least one entry
        payload = {
            "project_id": TEST_PROJECT_ID,
            "category": "Non-Modular Furniture",
            "material_name": "TEST_Custom Wardrobe",
            "quantity": 1,
            "rate_per_unit": 50000,
            "execution_date": datetime.now().strftime("%Y-%m-%d")
        }
        self.session.post(f"{BASE_URL}/api/finance/execution-ledger", json=payload)
        
        response = self.session.get(
            f"{BASE_URL}/api/finance/execution-ledger/export/{TEST_PROJECT_ID}",
            params={"format": "csv"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert "text/csv" in response.headers.get("Content-Type", ""), "Should return CSV content type"
        assert "attachment" in response.headers.get("Content-Disposition", ""), "Should have attachment disposition"
        
        # Verify CSV content
        content = response.text
        assert "Execution ID" in content, "CSV should have headers"
        assert "Category" in content
        assert "Material/Service" in content
        
        print(f"✓ CSV export successful, size: {len(content)} bytes")
    
    def test_export_excel(self):
        """GET /api/finance/execution-ledger/export/{project_id}?format=excel - export as Excel"""
        response = self.session.get(
            f"{BASE_URL}/api/finance/execution-ledger/export/{TEST_PROJECT_ID}",
            params={"format": "excel"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        content_type = response.headers.get("Content-Type", "")
        assert "spreadsheet" in content_type or "excel" in content_type.lower(), f"Should return Excel content type, got: {content_type}"
        
        print(f"✓ Excel export successful, size: {len(response.content)} bytes")
    
    # ============ CRITICAL: VERIFY NO IMPACT ON ACCOUNTING ============
    
    def test_execution_ledger_does_not_affect_project_finance_summary(self):
        """CRITICAL: Verify that execution ledger operations do NOT affect project finance summary"""
        # Step 1: Get current project finance summary
        finance_response = self.session.get(f"{BASE_URL}/api/finance/project-finance/{TEST_PROJECT_ID}")
        assert finance_response.status_code == 200, f"Failed to get project finance: {finance_response.text}"
        
        initial_summary = finance_response.json().get("summary", {})
        initial_contract_value = initial_summary.get("contract_value", 0)
        initial_total_received = initial_summary.get("total_received", 0)
        initial_planned_cost = initial_summary.get("planned_cost", 0)
        initial_actual_cost = initial_summary.get("actual_cost", 0)
        
        print(f"Initial finance summary:")
        print(f"  Contract Value: {initial_contract_value}")
        print(f"  Total Received: {initial_total_received}")
        print(f"  Planned Cost: {initial_planned_cost}")
        print(f"  Actual Cost: {initial_actual_cost}")
        
        # Step 2: Create a large execution entry
        payload = {
            "project_id": TEST_PROJECT_ID,
            "category": "Modular Material",
            "material_name": "TEST_Large Material Order",
            "quantity": 1000,
            "rate_per_unit": 1000,  # Total: 1,000,000
            "execution_date": datetime.now().strftime("%Y-%m-%d"),
            "remarks": "Test entry to verify no accounting impact"
        }
        create_response = self.session.post(f"{BASE_URL}/api/finance/execution-ledger", json=payload)
        assert create_response.status_code == 200
        entry_id = create_response.json()["entry"]["execution_id"]
        
        # Step 3: Get project finance summary AFTER creating execution entry
        finance_response_after = self.session.get(f"{BASE_URL}/api/finance/project-finance/{TEST_PROJECT_ID}")
        assert finance_response_after.status_code == 200
        
        after_summary = finance_response_after.json().get("summary", {})
        after_contract_value = after_summary.get("contract_value", 0)
        after_total_received = after_summary.get("total_received", 0)
        after_planned_cost = after_summary.get("planned_cost", 0)
        after_actual_cost = after_summary.get("actual_cost", 0)
        
        print(f"\nAfter adding execution entry (₹1,000,000):")
        print(f"  Contract Value: {after_contract_value}")
        print(f"  Total Received: {after_total_received}")
        print(f"  Planned Cost: {after_planned_cost}")
        print(f"  Actual Cost: {after_actual_cost}")
        
        # CRITICAL ASSERTIONS: Finance numbers should NOT change
        assert initial_contract_value == after_contract_value, \
            f"Contract value changed! Before: {initial_contract_value}, After: {after_contract_value}"
        assert initial_total_received == after_total_received, \
            f"Total received changed! Before: {initial_total_received}, After: {after_total_received}"
        assert initial_planned_cost == after_planned_cost, \
            f"Planned cost changed! Before: {initial_planned_cost}, After: {after_planned_cost}"
        assert initial_actual_cost == after_actual_cost, \
            f"Actual cost changed! Before: {initial_actual_cost}, After: {after_actual_cost}"
        
        print("\n✓ CRITICAL: Execution ledger entry did NOT affect project finance summary!")
        
        # Step 4: Delete the entry and verify again
        delete_response = self.session.delete(f"{BASE_URL}/api/finance/execution-ledger/{entry_id}")
        assert delete_response.status_code == 200
        
        finance_response_final = self.session.get(f"{BASE_URL}/api/finance/project-finance/{TEST_PROJECT_ID}")
        final_summary = finance_response_final.json().get("summary", {})
        
        assert initial_contract_value == final_summary.get("contract_value", 0), \
            "Contract value changed after deletion!"
        assert initial_actual_cost == final_summary.get("actual_cost", 0), \
            "Actual cost changed after deletion!"
        
        print("✓ CRITICAL: Deleting execution entry also did NOT affect project finance summary!")
    
    def test_execution_ledger_does_not_affect_cashbook(self):
        """CRITICAL: Verify that execution ledger does NOT create cashbook entries"""
        # Get current cashbook entries count for project
        cashbook_response = self.session.get(
            f"{BASE_URL}/api/finance/cashbook",
            params={"project_id": TEST_PROJECT_ID, "limit": 1000}
        )
        
        initial_count = 0
        if cashbook_response.status_code == 200:
            initial_count = len(cashbook_response.json().get("entries", []))
        
        # Create execution entry
        payload = {
            "project_id": TEST_PROJECT_ID,
            "category": "Factory / Job Work",
            "material_name": "TEST_Factory Work",
            "quantity": 1,
            "rate_per_unit": 100000,
            "execution_date": datetime.now().strftime("%Y-%m-%d")
        }
        create_response = self.session.post(f"{BASE_URL}/api/finance/execution-ledger", json=payload)
        assert create_response.status_code == 200
        entry_id = create_response.json()["entry"]["execution_id"]
        
        # Check cashbook again
        cashbook_response_after = self.session.get(
            f"{BASE_URL}/api/finance/cashbook",
            params={"project_id": TEST_PROJECT_ID, "limit": 1000}
        )
        
        after_count = 0
        if cashbook_response_after.status_code == 200:
            after_count = len(cashbook_response_after.json().get("entries", []))
        
        assert initial_count == after_count, \
            f"Cashbook entries changed! Before: {initial_count}, After: {after_count}"
        
        print(f"✓ CRITICAL: Execution ledger did NOT create cashbook entries (count: {initial_count} -> {after_count})")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/finance/execution-ledger/{entry_id}")
    
    # ============ AUTHENTICATION TESTS ============
    
    def test_unauthenticated_access_denied(self):
        """Verify unauthenticated requests are rejected"""
        # Create a new session without auth
        unauth_session = requests.Session()
        
        response = unauth_session.get(f"{BASE_URL}/api/finance/execution-ledger/categories")
        # Categories endpoint might be public, but project entries should require auth
        
        response = unauth_session.get(f"{BASE_URL}/api/finance/execution-ledger/project/{TEST_PROJECT_ID}")
        assert response.status_code == 401, f"Expected 401 for unauthenticated access, got {response.status_code}"
        
        print("✓ Unauthenticated access correctly denied")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
