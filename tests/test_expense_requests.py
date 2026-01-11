"""
Test suite for Leak-Proof Spend Control System - Expense Requests
Tests the complete expense lifecycle: Create -> Approve/Reject -> Record -> Mark Refund
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://budget-master-627.preview.emergentagent.com').rstrip('/')

# Test data
TEST_CATEGORY_ID = "cat_1a54fe27"  # Project Expenses
TEST_ACCOUNT_ID = "acc_d3cd5544"  # Petty Cash
TEST_PROJECT_ID = "proj_17942869"  # sharan - Interior Project


class TestExpenseRequestsAuth:
    """Test authentication and authorization for expense requests"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = s.post(f"{BASE_URL}/api/auth/local-login", json={
            "email": "thaha.pakayil@gmail.com",
            "password": "password123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        # Extract session token from cookies
        session_token = login_response.cookies.get("session_token")
        if session_token:
            s.headers.update({"Authorization": f"Bearer {session_token}"})
        
        return s
    
    def test_list_expense_requests_authenticated(self, session):
        """Test listing expense requests with authentication"""
        response = session.get(f"{BASE_URL}/api/finance/expense-requests")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} expense requests")
    
    def test_list_expense_requests_unauthenticated(self):
        """Test listing expense requests without authentication returns 401"""
        response = requests.get(f"{BASE_URL}/api/finance/expense-requests")
        assert response.status_code == 401
        print("✓ Unauthenticated request correctly rejected")


class TestExpenseRequestCRUD:
    """Test CRUD operations for expense requests"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        
        login_response = s.post(f"{BASE_URL}/api/auth/local-login", json={
            "email": "thaha.pakayil@gmail.com",
            "password": "password123"
        })
        assert login_response.status_code == 200
        
        session_token = login_response.cookies.get("session_token")
        if session_token:
            s.headers.update({"Authorization": f"Bearer {session_token}"})
        
        return s
    
    def test_create_expense_request_basic(self, session):
        """Test creating a basic expense request without project"""
        payload = {
            "category_id": TEST_CATEGORY_ID,
            "amount": 5000,
            "description": "TEST_Basic expense request for testing",
            "urgency": "normal"
        }
        
        response = session.post(f"{BASE_URL}/api/finance/expense-requests", json=payload)
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        data = response.json()
        assert data["request_id"] is not None
        assert data["request_number"].startswith("EXP-")
        assert data["amount"] == 5000
        assert data["status"] == "pending_approval"
        assert data["is_over_budget"] == False
        assert data["requester_name"] == "Thaha Pakayil"
        
        print(f"✓ Created expense request: {data['request_number']}")
        return data["request_id"]
    
    def test_create_expense_request_with_project(self, session):
        """Test creating expense request linked to a project"""
        payload = {
            "project_id": TEST_PROJECT_ID,
            "category_id": TEST_CATEGORY_ID,
            "amount": 10000,
            "description": "TEST_Project-linked expense for testing",
            "urgency": "high",
            "expected_date": "2026-01-15"
        }
        
        response = session.post(f"{BASE_URL}/api/finance/expense-requests", json=payload)
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        data = response.json()
        assert data["project_id"] == TEST_PROJECT_ID
        assert data["urgency"] == "high"
        assert "budget_info" in data
        
        print(f"✓ Created project-linked expense: {data['request_number']}")
        return data["request_id"]
    
    def test_create_expense_request_validation(self, session):
        """Test validation for expense request creation"""
        # Missing required fields
        payload = {
            "amount": 5000
        }
        
        response = session.post(f"{BASE_URL}/api/finance/expense-requests", json=payload)
        assert response.status_code == 422  # Validation error
        print("✓ Validation correctly rejects incomplete request")
    
    def test_get_expense_request_details(self, session):
        """Test getting single expense request details"""
        # First create one
        create_payload = {
            "category_id": TEST_CATEGORY_ID,
            "amount": 3000,
            "description": "TEST_Expense for detail view test",
            "urgency": "low"
        }
        create_response = session.post(f"{BASE_URL}/api/finance/expense-requests", json=create_payload)
        assert create_response.status_code == 200
        request_id = create_response.json()["request_id"]
        
        # Get details
        response = session.get(f"{BASE_URL}/api/finance/expense-requests/{request_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["request_id"] == request_id
        assert data["amount"] == 3000
        assert "activity_log" in data
        assert len(data["activity_log"]) >= 1
        
        print(f"✓ Retrieved expense request details: {data['request_number']}")
    
    def test_list_expense_requests_with_filters(self, session):
        """Test listing expense requests with status filter"""
        response = session.get(f"{BASE_URL}/api/finance/expense-requests?status=pending_approval")
        assert response.status_code == 200
        
        data = response.json()
        for req in data:
            assert req["status"] == "pending_approval"
        
        print(f"✓ Filtered list returned {len(data)} pending requests")


class TestExpenseRequestApproval:
    """Test approval/rejection workflow"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        
        login_response = s.post(f"{BASE_URL}/api/auth/local-login", json={
            "email": "thaha.pakayil@gmail.com",
            "password": "password123"
        })
        assert login_response.status_code == 200
        
        session_token = login_response.cookies.get("session_token")
        if session_token:
            s.headers.update({"Authorization": f"Bearer {session_token}"})
        
        return s
    
    def test_approve_expense_request(self, session):
        """Test approving an expense request"""
        # Create a request first
        create_payload = {
            "category_id": TEST_CATEGORY_ID,
            "amount": 7500,
            "description": "TEST_Expense for approval test",
            "urgency": "normal"
        }
        create_response = session.post(f"{BASE_URL}/api/finance/expense-requests", json=create_payload)
        assert create_response.status_code == 200
        request_id = create_response.json()["request_id"]
        
        # Approve it
        approve_payload = {
            "action": "approve",
            "remarks": "Approved for testing purposes"
        }
        response = session.post(f"{BASE_URL}/api/finance/expense-requests/{request_id}/approve", json=approve_payload)
        assert response.status_code == 200, f"Approve failed: {response.text}"
        
        data = response.json()
        assert data["status"] == "approved"
        assert data["approved_by_name"] == "Thaha Pakayil"
        assert data["approval_remarks"] == "Approved for testing purposes"
        
        print(f"✓ Approved expense request: {data['request_number']}")
        return request_id
    
    def test_reject_expense_request(self, session):
        """Test rejecting an expense request"""
        # Create a request first
        create_payload = {
            "category_id": TEST_CATEGORY_ID,
            "amount": 8000,
            "description": "TEST_Expense for rejection test",
            "urgency": "normal"
        }
        create_response = session.post(f"{BASE_URL}/api/finance/expense-requests", json=create_payload)
        assert create_response.status_code == 200
        request_id = create_response.json()["request_id"]
        
        # Reject it
        reject_payload = {
            "action": "reject",
            "remarks": "Rejected for testing purposes"
        }
        response = session.post(f"{BASE_URL}/api/finance/expense-requests/{request_id}/approve", json=reject_payload)
        assert response.status_code == 200, f"Reject failed: {response.text}"
        
        data = response.json()
        assert data["status"] == "rejected"
        assert data["rejected_by_name"] == "Thaha Pakayil"
        
        print(f"✓ Rejected expense request: {data['request_number']}")
    
    def test_cannot_approve_already_approved(self, session):
        """Test that already approved requests cannot be approved again"""
        # Create and approve
        create_payload = {
            "category_id": TEST_CATEGORY_ID,
            "amount": 6000,
            "description": "TEST_Expense for double approval test",
            "urgency": "normal"
        }
        create_response = session.post(f"{BASE_URL}/api/finance/expense-requests", json=create_payload)
        request_id = create_response.json()["request_id"]
        
        # First approval
        session.post(f"{BASE_URL}/api/finance/expense-requests/{request_id}/approve", json={"action": "approve"})
        
        # Try to approve again
        response = session.post(f"{BASE_URL}/api/finance/expense-requests/{request_id}/approve", json={"action": "approve"})
        assert response.status_code == 400
        
        print("✓ Double approval correctly prevented")


class TestExpenseRequestRecording:
    """Test recording approved expenses in cashbook"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        
        login_response = s.post(f"{BASE_URL}/api/auth/local-login", json={
            "email": "thaha.pakayil@gmail.com",
            "password": "password123"
        })
        assert login_response.status_code == 200
        
        session_token = login_response.cookies.get("session_token")
        if session_token:
            s.headers.update({"Authorization": f"Bearer {session_token}"})
        
        return s
    
    def test_record_approved_expense(self, session):
        """Test recording an approved expense in cashbook"""
        # Create and approve
        create_payload = {
            "category_id": TEST_CATEGORY_ID,
            "amount": 4500,
            "description": "TEST_Expense for recording test",
            "urgency": "normal"
        }
        create_response = session.post(f"{BASE_URL}/api/finance/expense-requests", json=create_payload)
        request_id = create_response.json()["request_id"]
        
        # Approve
        session.post(f"{BASE_URL}/api/finance/expense-requests/{request_id}/approve", json={"action": "approve"})
        
        # Record
        record_payload = {
            "account_id": TEST_ACCOUNT_ID,
            "mode": "cash",
            "transaction_date": "2026-01-10",
            "paid_to": "Test Vendor",
            "remarks": "Recorded for testing"
        }
        response = session.post(f"{BASE_URL}/api/finance/expense-requests/{request_id}/record", json=record_payload)
        assert response.status_code == 200, f"Record failed: {response.text}"
        
        data = response.json()
        assert data["status"] == "recorded"
        assert data["transaction_id"] is not None
        assert data["recorded_by_name"] == "Thaha Pakayil"
        
        print(f"✓ Recorded expense: {data['request_number']} -> Transaction: {data['transaction_id']}")
        return request_id
    
    def test_cannot_record_pending_expense(self, session):
        """Test that pending expenses cannot be recorded"""
        # Create but don't approve
        create_payload = {
            "category_id": TEST_CATEGORY_ID,
            "amount": 3500,
            "description": "TEST_Expense for invalid recording test",
            "urgency": "normal"
        }
        create_response = session.post(f"{BASE_URL}/api/finance/expense-requests", json=create_payload)
        request_id = create_response.json()["request_id"]
        
        # Try to record without approval
        record_payload = {
            "account_id": TEST_ACCOUNT_ID,
            "mode": "cash",
            "transaction_date": "2026-01-10"
        }
        response = session.post(f"{BASE_URL}/api/finance/expense-requests/{request_id}/record", json=record_payload)
        assert response.status_code == 400
        
        print("✓ Recording pending expense correctly prevented")


class TestExpenseRequestRefund:
    """Test refund tracking workflow"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        
        login_response = s.post(f"{BASE_URL}/api/auth/local-login", json={
            "email": "thaha.pakayil@gmail.com",
            "password": "password123"
        })
        assert login_response.status_code == 200
        
        session_token = login_response.cookies.get("session_token")
        if session_token:
            s.headers.update({"Authorization": f"Bearer {session_token}"})
        
        return s
    
    def test_mark_refund_pending(self, session):
        """Test marking a recorded expense as refund pending"""
        # Create, approve, and record
        create_payload = {
            "category_id": TEST_CATEGORY_ID,
            "amount": 5500,
            "description": "TEST_Expense for refund test",
            "urgency": "normal"
        }
        create_response = session.post(f"{BASE_URL}/api/finance/expense-requests", json=create_payload)
        request_id = create_response.json()["request_id"]
        
        # Approve
        session.post(f"{BASE_URL}/api/finance/expense-requests/{request_id}/approve", json={"action": "approve"})
        
        # Record
        record_payload = {
            "account_id": TEST_ACCOUNT_ID,
            "mode": "cash",
            "transaction_date": "2026-01-10"
        }
        session.post(f"{BASE_URL}/api/finance/expense-requests/{request_id}/record", json=record_payload)
        
        # Mark refund pending
        refund_payload = {
            "refund_expected_amount": 5500,
            "refund_expected_date": "2026-01-20",
            "refund_notes": "Full refund expected from vendor"
        }
        response = session.post(f"{BASE_URL}/api/finance/expense-requests/{request_id}/mark-refund-pending", json=refund_payload)
        assert response.status_code == 200, f"Mark refund failed: {response.text}"
        
        data = response.json()
        assert data["status"] == "refund_pending"
        assert data["refund_expected_amount"] == 5500
        assert data["refund_status"] == "pending"
        
        print(f"✓ Marked refund pending: {data['request_number']}")
    
    def test_cannot_mark_refund_on_pending_expense(self, session):
        """Test that pending expenses cannot be marked for refund"""
        # Create but don't approve
        create_payload = {
            "category_id": TEST_CATEGORY_ID,
            "amount": 2500,
            "description": "TEST_Expense for invalid refund test",
            "urgency": "normal"
        }
        create_response = session.post(f"{BASE_URL}/api/finance/expense-requests", json=create_payload)
        request_id = create_response.json()["request_id"]
        
        # Try to mark refund
        refund_payload = {
            "refund_expected_amount": 2500
        }
        response = session.post(f"{BASE_URL}/api/finance/expense-requests/{request_id}/mark-refund-pending", json=refund_payload)
        assert response.status_code == 400
        
        print("✓ Marking refund on pending expense correctly prevented")


class TestExpenseRequestSummary:
    """Test summary statistics endpoint"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        
        login_response = s.post(f"{BASE_URL}/api/auth/local-login", json={
            "email": "thaha.pakayil@gmail.com",
            "password": "password123"
        })
        assert login_response.status_code == 200
        
        session_token = login_response.cookies.get("session_token")
        if session_token:
            s.headers.update({"Authorization": f"Bearer {session_token}"})
        
        return s
    
    def test_get_summary_stats(self, session):
        """Test getting expense request summary statistics"""
        response = session.get(f"{BASE_URL}/api/finance/expense-requests/stats/summary")
        assert response.status_code == 200
        
        data = response.json()
        assert "status_summary" in data
        assert "money_at_risk" in data
        assert "pending_refunds_count" in data
        assert "over_budget_count" in data
        assert "total_pending_approval" in data
        assert "total_approved_unrecorded" in data
        
        print(f"✓ Summary stats retrieved:")
        print(f"  - Pending approval: {data['total_pending_approval']}")
        print(f"  - Approved unrecorded: {data['total_approved_unrecorded']}")
        print(f"  - Pending refunds: {data['pending_refunds_count']}")
        print(f"  - Money at risk: ₹{data['money_at_risk']:,.0f}")


class TestExpenseRequestClose:
    """Test closing expense requests"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        
        login_response = s.post(f"{BASE_URL}/api/auth/local-login", json={
            "email": "thaha.pakayil@gmail.com",
            "password": "password123"
        })
        assert login_response.status_code == 200
        
        session_token = login_response.cookies.get("session_token")
        if session_token:
            s.headers.update({"Authorization": f"Bearer {session_token}"})
        
        return s
    
    def test_close_recorded_expense(self, session):
        """Test closing a recorded expense"""
        # Create, approve, and record
        create_payload = {
            "category_id": TEST_CATEGORY_ID,
            "amount": 3000,
            "description": "TEST_Expense for close test",
            "urgency": "normal"
        }
        create_response = session.post(f"{BASE_URL}/api/finance/expense-requests", json=create_payload)
        request_id = create_response.json()["request_id"]
        
        # Approve
        session.post(f"{BASE_URL}/api/finance/expense-requests/{request_id}/approve", json={"action": "approve"})
        
        # Record
        record_payload = {
            "account_id": TEST_ACCOUNT_ID,
            "mode": "cash",
            "transaction_date": "2026-01-10"
        }
        session.post(f"{BASE_URL}/api/finance/expense-requests/{request_id}/record", json=record_payload)
        
        # Close
        response = session.post(f"{BASE_URL}/api/finance/expense-requests/{request_id}/close", json={})
        assert response.status_code == 200, f"Close failed: {response.text}"
        
        data = response.json()
        assert data["status"] == "closed"
        
        print(f"✓ Closed expense: {data['request_number']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
