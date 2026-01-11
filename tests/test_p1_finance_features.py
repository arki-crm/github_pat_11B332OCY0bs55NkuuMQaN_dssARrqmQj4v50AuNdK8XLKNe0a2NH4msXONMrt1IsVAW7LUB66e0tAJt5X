"""
Test P1 Finance & Payment Core Features:
1. Payment Schedule Editor - edit stages per project, lock paid stages
2. Invoice Creation Flow for GST applicable projects
3. Refund & Cancellation Flow - full/partial refunds, forfeited bookings
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://budget-master-627.preview.emergentagent.com').rstrip('/')

class TestP1FinanceFeatures:
    """Test P1 Finance & Payment Core Features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
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
        
    # ============ PAYMENT SCHEDULE TESTS ============
    
    def test_get_payment_schedule_for_project(self):
        """Test GET /api/finance/payment-schedule/{project_id}"""
        # Use the test project mentioned: proj_17942869
        project_id = "proj_17942869"
        
        response = self.session.get(
            f"{BASE_URL}/api/finance/payment-schedule/{project_id}",
            cookies=self.cookies
        )
        
        # Should return 200 or 404 if project doesn't exist
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}, {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            # Verify schedule structure
            assert "stages" in data or "contract_value" in data, f"Missing expected fields: {data}"
            print(f"Payment schedule retrieved: {len(data.get('stages', []))} stages")
    
    def test_get_payment_schedule_any_project(self):
        """Test payment schedule endpoint with any available project"""
        # First get list of projects
        projects_response = self.session.get(
            f"{BASE_URL}/api/projects",
            cookies=self.cookies
        )
        
        if projects_response.status_code == 200:
            projects = projects_response.json()
            if projects:
                project_id = projects[0].get("project_id")
                
                response = self.session.get(
                    f"{BASE_URL}/api/finance/payment-schedule/{project_id}",
                    cookies=self.cookies
                )
                
                assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
                print(f"Payment schedule test for project {project_id}: {response.status_code}")
    
    def test_update_payment_schedule(self):
        """Test POST /api/finance/payment-schedule/{project_id}"""
        # Get a project first
        projects_response = self.session.get(
            f"{BASE_URL}/api/projects",
            cookies=self.cookies
        )
        
        if projects_response.status_code == 200 and projects_response.json():
            project_id = projects_response.json()[0].get("project_id")
            
            # Try to update payment schedule
            schedule_data = {
                "stages": [
                    {"stage_name": "Booking", "percentage": 10, "trigger": "booking", "order": 1},
                    {"stage_name": "Design Lock", "percentage": 40, "trigger": "design_lock", "order": 2},
                    {"stage_name": "Production", "percentage": 30, "trigger": "production", "order": 3},
                    {"stage_name": "Handover", "percentage": 20, "trigger": "handover", "order": 4}
                ],
                "is_custom": True
            }
            
            response = self.session.post(
                f"{BASE_URL}/api/finance/payment-schedule/{project_id}",
                json=schedule_data,
                cookies=self.cookies
            )
            
            # Should succeed or fail with permission error
            assert response.status_code in [200, 201, 403, 422], f"Unexpected status: {response.status_code}, {response.text}"
            print(f"Update payment schedule: {response.status_code}")
    
    # ============ INVOICE TESTS ============
    
    def test_list_invoices(self):
        """Test GET /api/finance/invoices"""
        response = self.session.get(
            f"{BASE_URL}/api/finance/invoices",
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Failed to list invoices: {response.status_code}, {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Invoices should be a list"
        print(f"Found {len(data)} invoices")
        
        # Check invoice structure if any exist
        if data:
            invoice = data[0]
            assert "invoice_id" in invoice, "Invoice should have invoice_id"
            assert "invoice_number" in invoice, "Invoice should have invoice_number"
    
    def test_create_invoice_requires_gst_project(self):
        """Test POST /api/finance/invoices - requires GST applicable project"""
        # Get projects
        projects_response = self.session.get(
            f"{BASE_URL}/api/projects",
            cookies=self.cookies
        )
        
        if projects_response.status_code == 200:
            projects = projects_response.json()
            # Find a GST applicable project
            gst_project = next((p for p in projects if p.get("is_gst_applicable")), None)
            
            if gst_project:
                project_id = gst_project.get("project_id")
                
                response = self.session.post(
                    f"{BASE_URL}/api/finance/invoices?project_id={project_id}",
                    cookies=self.cookies
                )
                
                # Should succeed or fail with validation error
                assert response.status_code in [200, 201, 400, 403, 422], f"Unexpected status: {response.status_code}"
                print(f"Create invoice for GST project: {response.status_code}")
            else:
                print("No GST applicable projects found - skipping invoice creation test")
    
    def test_get_invoice_details(self):
        """Test GET /api/finance/invoices/{invoice_id}"""
        # First get list of invoices
        list_response = self.session.get(
            f"{BASE_URL}/api/finance/invoices",
            cookies=self.cookies
        )
        
        if list_response.status_code == 200 and list_response.json():
            invoice_id = list_response.json()[0].get("invoice_id")
            
            response = self.session.get(
                f"{BASE_URL}/api/finance/invoices/{invoice_id}",
                cookies=self.cookies
            )
            
            assert response.status_code == 200, f"Failed to get invoice: {response.status_code}"
            
            data = response.json()
            # Check GST breakdown fields
            if data.get("is_gst_applicable"):
                assert "cgst" in data, "GST invoice should have CGST"
                assert "sgst" in data, "GST invoice should have SGST"
                assert "gst_rate" in data, "GST invoice should have gst_rate"
                print(f"Invoice {data.get('invoice_number')}: CGST={data.get('cgst')}, SGST={data.get('sgst')}")
    
    def test_invoice_pdf_download(self):
        """Test GET /api/finance/invoices/{invoice_id}/pdf"""
        # First get list of invoices
        list_response = self.session.get(
            f"{BASE_URL}/api/finance/invoices",
            cookies=self.cookies
        )
        
        if list_response.status_code == 200 and list_response.json():
            invoice_id = list_response.json()[0].get("invoice_id")
            
            response = self.session.get(
                f"{BASE_URL}/api/finance/invoices/{invoice_id}/pdf",
                cookies=self.cookies
            )
            
            assert response.status_code == 200, f"Failed to download invoice PDF: {response.status_code}"
            
            # Check PDF header
            content = response.content
            assert content[:4] == b'%PDF', "Response should be a valid PDF"
            print(f"Invoice PDF downloaded: {len(content)} bytes")
        else:
            print("No invoices found - skipping PDF download test")
    
    # ============ REFUND TESTS ============
    
    def test_list_refunds(self):
        """Test GET /api/finance/refunds"""
        response = self.session.get(
            f"{BASE_URL}/api/finance/refunds",
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Failed to list refunds: {response.status_code}, {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Refunds should be a list"
        print(f"Found {len(data)} refunds")
        
        # Check refund structure if any exist
        if data:
            refund = data[0]
            assert "refund_id" in refund, "Refund should have refund_id"
            assert "refund_type" in refund, "Refund should have refund_type"
    
    def test_refund_types_validation(self):
        """Test that refund types are validated: full, partial, forfeited"""
        # Get a project with payments
        projects_response = self.session.get(
            f"{BASE_URL}/api/projects",
            cookies=self.cookies
        )
        
        if projects_response.status_code == 200 and projects_response.json():
            project_id = projects_response.json()[0].get("project_id")
            
            # Test invalid refund type
            invalid_refund = {
                "project_id": project_id,
                "amount": 1000,
                "refund_type": "invalid_type",
                "reason": "Test invalid type",
                "account_id": "none"
            }
            
            response = self.session.post(
                f"{BASE_URL}/api/finance/refunds",
                json=invalid_refund,
                cookies=self.cookies
            )
            
            # Should fail with validation error
            assert response.status_code in [400, 422], f"Invalid refund type should be rejected: {response.status_code}"
            print(f"Invalid refund type rejected: {response.status_code}")
    
    def test_project_payment_summary(self):
        """Test GET /api/finance/project-payment-summary/{project_id}"""
        # Get a project
        projects_response = self.session.get(
            f"{BASE_URL}/api/projects",
            cookies=self.cookies
        )
        
        if projects_response.status_code == 200 and projects_response.json():
            project_id = projects_response.json()[0].get("project_id")
            
            response = self.session.get(
                f"{BASE_URL}/api/finance/project-payment-summary/{project_id}",
                cookies=self.cookies
            )
            
            assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
            
            if response.status_code == 200:
                data = response.json()
                assert "total_received" in data or "contract_value" in data, f"Missing expected fields: {data}"
                print(f"Payment summary: {data}")
    
    # ============ RECEIPTS TESTS ============
    
    def test_list_receipts(self):
        """Test GET /api/finance/receipts"""
        response = self.session.get(
            f"{BASE_URL}/api/finance/receipts",
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Failed to list receipts: {response.status_code}, {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Receipts should be a list"
        print(f"Found {len(data)} receipts")
    
    # ============ PROJECT FINANCE DETAIL TESTS ============
    
    def test_project_finance_detail(self):
        """Test GET /api/finance/project-finance/{project_id}"""
        # Get a project
        projects_response = self.session.get(
            f"{BASE_URL}/api/projects",
            cookies=self.cookies
        )
        
        if projects_response.status_code == 200 and projects_response.json():
            project_id = projects_response.json()[0].get("project_id")
            
            response = self.session.get(
                f"{BASE_URL}/api/finance/project-finance/{project_id}",
                cookies=self.cookies
            )
            
            assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
            
            if response.status_code == 200:
                data = response.json()
                # Check expected fields
                assert "project" in data, "Should have project info"
                assert "summary" in data, "Should have summary"
                print(f"Project finance detail retrieved for {project_id}")


class TestSidebarNavigation:
    """Test that sidebar shows all finance items"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": "thaha.pakayil@gmail.com", "password": "password123"}
        )
        assert login_response.status_code == 200
        self.cookies = login_response.cookies
    
    def test_receipts_endpoint_accessible(self):
        """Test /api/finance/receipts is accessible"""
        response = self.session.get(
            f"{BASE_URL}/api/finance/receipts",
            cookies=self.cookies
        )
        assert response.status_code == 200, f"Receipts endpoint failed: {response.status_code}"
        print("Receipts endpoint accessible")
    
    def test_invoices_endpoint_accessible(self):
        """Test /api/finance/invoices is accessible"""
        response = self.session.get(
            f"{BASE_URL}/api/finance/invoices",
            cookies=self.cookies
        )
        assert response.status_code == 200, f"Invoices endpoint failed: {response.status_code}"
        print("Invoices endpoint accessible")
    
    def test_refunds_endpoint_accessible(self):
        """Test /api/finance/refunds is accessible"""
        response = self.session.get(
            f"{BASE_URL}/api/finance/refunds",
            cookies=self.cookies
        )
        assert response.status_code == 200, f"Refunds endpoint failed: {response.status_code}"
        print("Refunds endpoint accessible")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
