"""
Test suite for Receipts and PDF Generation feature
Tests: Receipt CRUD, PDF generation, Company settings
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestReceiptsAndPDF:
    """Test receipts CRUD and PDF generation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get session
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": "thaha.pakayil@gmail.com", "password": "password123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        # Store cookies for subsequent requests
        self.cookies = login_response.cookies
        
    def test_list_receipts(self):
        """Test GET /api/finance/receipts - list all receipts"""
        response = self.session.get(f"{BASE_URL}/api/finance/receipts", cookies=self.cookies)
        assert response.status_code == 200, f"Failed to list receipts: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Check receipt structure if any exist
        if len(data) > 0:
            receipt = data[0]
            assert "receipt_id" in receipt
            assert "receipt_number" in receipt
            assert "amount" in receipt
            assert "payment_mode" in receipt
            assert "project_id" in receipt
            print(f"✓ Found {len(data)} receipts")
    
    def test_get_company_settings(self):
        """Test GET /api/finance/company-settings"""
        response = self.session.get(f"{BASE_URL}/api/finance/company-settings", cookies=self.cookies)
        assert response.status_code == 200, f"Failed to get company settings: {response.text}"
        
        data = response.json()
        assert "company_name" in data
        assert "authorized_signatory" in data
        print(f"✓ Company settings: {data.get('company_name')}")
    
    def test_update_company_settings(self):
        """Test POST /api/finance/company-settings"""
        settings = {
            "company_name": "Arki Dots",
            "company_tagline": "Interior Design Excellence",
            "authorized_signatory": "Test Signatory"
        }
        response = self.session.post(
            f"{BASE_URL}/api/finance/company-settings",
            json=settings,
            cookies=self.cookies
        )
        assert response.status_code == 200, f"Failed to update company settings: {response.text}"
        print("✓ Company settings updated")
    
    def test_get_projects_for_receipt(self):
        """Test GET /api/finance/project-finance - needed for receipt creation"""
        response = self.session.get(f"{BASE_URL}/api/finance/project-finance", cookies=self.cookies)
        assert response.status_code == 200, f"Failed to get projects: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Found {len(data)} projects for receipt creation")
        return data
    
    def test_get_accounts_for_receipt(self):
        """Test GET /api/accounting/accounts - needed for receipt creation"""
        response = self.session.get(f"{BASE_URL}/api/accounting/accounts", cookies=self.cookies)
        assert response.status_code == 200, f"Failed to get accounts: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Found {len(data)} accounts for receipt creation")
        return data
    
    def test_create_receipt(self):
        """Test POST /api/finance/receipts - create new receipt"""
        # First get a project and account
        projects = self.test_get_projects_for_receipt()
        accounts = self.test_get_accounts_for_receipt()
        
        # Find a project with contract value
        project = None
        for p in projects:
            if p.get("contract_value", 0) > 0:
                project = p
                break
        
        if not project:
            pytest.skip("No project with contract value found")
        
        account = accounts[0] if accounts else None
        if not account:
            pytest.skip("No accounts found")
        
        # Create receipt
        receipt_data = {
            "project_id": project["project_id"],
            "amount": 10000,
            "payment_mode": "cash",
            "account_id": account["account_id"],
            "stage_name": "TEST_Payment",
            "notes": "Test receipt created by pytest"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/finance/receipts",
            json=receipt_data,
            cookies=self.cookies
        )
        assert response.status_code == 200, f"Failed to create receipt: {response.text}"
        
        data = response.json()
        assert "receipt_id" in data
        assert "receipt_number" in data
        assert data["amount"] == 10000
        assert data["payment_mode"] == "cash"
        print(f"✓ Created receipt: {data['receipt_number']}")
        
        return data["receipt_id"]
    
    def test_get_single_receipt(self):
        """Test GET /api/finance/receipts/{receipt_id}"""
        # First create a receipt
        receipt_id = self.test_create_receipt()
        
        # Get the receipt
        response = self.session.get(
            f"{BASE_URL}/api/finance/receipts/{receipt_id}",
            cookies=self.cookies
        )
        assert response.status_code == 200, f"Failed to get receipt: {response.text}"
        
        data = response.json()
        assert data["receipt_id"] == receipt_id
        assert "project" in data
        assert "account_name" in data
        assert "total_received" in data
        assert "balance_remaining" in data or data.get("balance_remaining") is not None
        print(f"✓ Got receipt details with project info")
        
        return receipt_id
    
    def test_generate_pdf(self):
        """Test GET /api/finance/receipts/{receipt_id}/pdf - PDF generation"""
        # First create a receipt
        receipt_id = self.test_create_receipt()
        
        # Generate PDF
        response = self.session.get(
            f"{BASE_URL}/api/finance/receipts/{receipt_id}/pdf",
            cookies=self.cookies
        )
        assert response.status_code == 200, f"Failed to generate PDF: {response.text}"
        
        # Check content type
        content_type = response.headers.get("Content-Type", "")
        assert "application/pdf" in content_type, f"Expected PDF content type, got: {content_type}"
        
        # Check PDF header
        content = response.content
        assert content.startswith(b"%PDF"), "Response should be a valid PDF"
        assert len(content) > 1000, f"PDF seems too small: {len(content)} bytes"
        
        print(f"✓ Generated PDF: {len(content)} bytes")
    
    def test_pdf_for_existing_receipt(self):
        """Test PDF generation for existing receipt"""
        # Get list of receipts
        response = self.session.get(f"{BASE_URL}/api/finance/receipts", cookies=self.cookies)
        assert response.status_code == 200
        
        receipts = response.json()
        if not receipts:
            pytest.skip("No receipts found")
        
        receipt_id = receipts[0]["receipt_id"]
        
        # Generate PDF
        response = self.session.get(
            f"{BASE_URL}/api/finance/receipts/{receipt_id}/pdf",
            cookies=self.cookies
        )
        assert response.status_code == 200, f"Failed to generate PDF: {response.text}"
        assert response.content.startswith(b"%PDF"), "Response should be a valid PDF"
        print(f"✓ Generated PDF for existing receipt: {receipts[0]['receipt_number']}")
    
    def test_receipt_not_found(self):
        """Test 404 for non-existent receipt"""
        response = self.session.get(
            f"{BASE_URL}/api/finance/receipts/nonexistent_id",
            cookies=self.cookies
        )
        assert response.status_code == 404, f"Expected 404, got: {response.status_code}"
        print("✓ Correctly returns 404 for non-existent receipt")
    
    def test_pdf_not_found(self):
        """Test 404 for PDF of non-existent receipt"""
        response = self.session.get(
            f"{BASE_URL}/api/finance/receipts/nonexistent_id/pdf",
            cookies=self.cookies
        )
        assert response.status_code == 404, f"Expected 404, got: {response.status_code}"
        print("✓ Correctly returns 404 for PDF of non-existent receipt")
    
    def test_create_receipt_validation(self):
        """Test receipt creation validation"""
        # Missing required fields
        response = self.session.post(
            f"{BASE_URL}/api/finance/receipts",
            json={"amount": 1000},  # Missing project_id, payment_mode, account_id
            cookies=self.cookies
        )
        assert response.status_code == 422, f"Expected 422 for validation error, got: {response.status_code}"
        print("✓ Correctly validates required fields")


class TestReceiptsListColumns:
    """Test that receipts list returns correct columns"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": "thaha.pakayil@gmail.com", "password": "password123"}
        )
        assert login_response.status_code == 200
        self.cookies = login_response.cookies
    
    def test_receipt_columns(self):
        """Verify receipt list has all required columns"""
        response = self.session.get(f"{BASE_URL}/api/finance/receipts", cookies=self.cookies)
        assert response.status_code == 200
        
        receipts = response.json()
        if not receipts:
            pytest.skip("No receipts to verify columns")
        
        receipt = receipts[0]
        
        # Required columns for the table
        required_fields = [
            "receipt_number",  # Receipt #
            "payment_date",    # Date
            "project_name",    # Project
            "client_name",     # Customer
            "amount",          # Amount
            "payment_mode",    # Mode
            "account_name",    # Account
            "receipt_id"       # For actions
        ]
        
        for field in required_fields:
            assert field in receipt, f"Missing field: {field}"
        
        print(f"✓ All required columns present: {required_fields}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
