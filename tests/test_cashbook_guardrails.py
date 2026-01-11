"""
Test Cashbook Guardrails and Expense Accountability Enhancement
Tests for:
- Amount-based guardrails: ₹0-1000 (petty cash), ₹1001-5000 (needs review), ₹5001+ (approval required)
- Mandatory responsibility fields: requested_by, paid_by, approved_by
- Review visibility for Admin/CEO
- New API endpoints: review-summary, needs-review, mark-reviewed, users-for-approval, approved-expense-requests
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://budget-control-57.preview.emergentagent.com').rstrip('/')


class TestCashbookGuardrails:
    """Test cashbook guardrails and accountability features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": "thaha.pakayil@gmail.com", "password": "password123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        # Get accounts and categories for transaction creation
        accounts_res = self.session.get(f"{BASE_URL}/api/accounting/accounts")
        if accounts_res.status_code == 200 and accounts_res.json():
            self.account_id = accounts_res.json()[0].get("account_id")
        else:
            self.account_id = None
            
        categories_res = self.session.get(f"{BASE_URL}/api/accounting/categories")
        if categories_res.status_code == 200 and categories_res.json():
            self.category_id = categories_res.json()[0].get("category_id")
        else:
            self.category_id = None
        
        yield
        
        # Cleanup - no specific cleanup needed as we use unique remarks
    
    # ============ REVIEW SUMMARY ENDPOINT TESTS ============
    
    def test_review_summary_endpoint_returns_counts(self):
        """GET /api/accounting/transactions/review-summary returns needs_review_count, needs_review_amount, pending_approval_count"""
        response = self.session.get(f"{BASE_URL}/api/accounting/transactions/review-summary")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "needs_review_count" in data, "Missing needs_review_count field"
        assert "needs_review_amount" in data, "Missing needs_review_amount field"
        assert "pending_approval_count" in data, "Missing pending_approval_count field"
        
        # Verify types
        assert isinstance(data["needs_review_count"], int), "needs_review_count should be int"
        assert isinstance(data["needs_review_amount"], (int, float)), "needs_review_amount should be numeric"
        assert isinstance(data["pending_approval_count"], int), "pending_approval_count should be int"
        
        print(f"✓ Review summary: {data}")
    
    # ============ NEEDS REVIEW ENDPOINT TESTS ============
    
    def test_needs_review_endpoint_returns_flagged_transactions(self):
        """GET /api/accounting/transactions/needs-review returns transactions flagged for review"""
        response = self.session.get(f"{BASE_URL}/api/accounting/transactions/needs-review")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Should return a list
        assert isinstance(data, list), "Expected list of transactions"
        
        # If there are transactions, verify they have needs_review=True
        for txn in data[:5]:  # Check first 5
            assert txn.get("needs_review") == True, f"Transaction {txn.get('transaction_id')} should have needs_review=True"
        
        print(f"✓ Needs review endpoint returned {len(data)} transactions")
    
    # ============ USERS FOR APPROVAL ENDPOINT TESTS ============
    
    def test_users_for_approval_endpoint(self):
        """GET /api/accounting/users-for-approval returns list of users who can approve"""
        response = self.session.get(f"{BASE_URL}/api/accounting/users-for-approval")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Should return a list
        assert isinstance(data, list), "Expected list of approvers"
        
        # Each approver should have required fields
        for approver in data[:5]:
            assert "user_id" in approver, "Approver missing user_id"
            assert "name" in approver, "Approver missing name"
            assert "role" in approver, "Approver missing role"
        
        print(f"✓ Users for approval: {len(data)} approvers found")
    
    # ============ APPROVED EXPENSE REQUESTS ENDPOINT TESTS ============
    
    def test_approved_expense_requests_endpoint(self):
        """GET /api/accounting/approved-expense-requests returns approved expense requests for linking"""
        response = self.session.get(f"{BASE_URL}/api/accounting/approved-expense-requests")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Should return a list
        assert isinstance(data, list), "Expected list of expense requests"
        
        # If there are requests, verify structure - note: title field may not exist in older records
        for req in data[:5]:
            assert "request_id" in req, "Request missing request_id"
            assert "amount" in req, "Request missing amount"
            # Note: title and requested_by_name may be missing in older expense requests
        
        print(f"✓ Approved expense requests: {len(data)} requests found")
    
    # ============ PETTY CASH TRANSACTION TESTS (₹0-1000) ============
    
    def test_petty_cash_transaction_direct_entry(self):
        """POST /api/accounting/transactions with amount <=1000 should have approval_status=not_required"""
        if not self.account_id or not self.category_id:
            pytest.skip("No account or category available for testing")
        
        test_id = uuid.uuid4().hex[:8]
        txn_data = {
            "transaction_date": datetime.now().isoformat(),
            "transaction_type": "outflow",
            "amount": 500,  # Petty cash range
            "mode": "cash",
            "category_id": self.category_id,
            "account_id": self.account_id,
            "remarks": f"TEST_petty_cash_{test_id}",
            "paid_to": "Test Vendor"
        }
        
        response = self.session.post(f"{BASE_URL}/api/accounting/transactions", json=txn_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify guardrail fields
        assert data.get("approval_status") == "not_required", f"Expected approval_status=not_required, got {data.get('approval_status')}"
        assert data.get("needs_review") == False, f"Expected needs_review=False, got {data.get('needs_review')}"
        
        # Verify accountability fields are set
        assert data.get("requested_by") is not None, "requested_by should be set"
        assert data.get("requested_by_name") is not None, "requested_by_name should be set"
        assert data.get("paid_by") is not None, "paid_by should be set"
        assert data.get("paid_by_name") is not None, "paid_by_name should be set"
        
        print(f"✓ Petty cash transaction (₹500): approval_status={data.get('approval_status')}, needs_review={data.get('needs_review')}")
    
    def test_petty_cash_boundary_1000(self):
        """POST /api/accounting/transactions with amount=1000 should still be petty cash"""
        if not self.account_id or not self.category_id:
            pytest.skip("No account or category available for testing")
        
        test_id = uuid.uuid4().hex[:8]
        txn_data = {
            "transaction_date": datetime.now().isoformat(),
            "transaction_type": "outflow",
            "amount": 1000,  # Boundary - still petty cash
            "mode": "cash",
            "category_id": self.category_id,
            "account_id": self.account_id,
            "remarks": f"TEST_petty_boundary_{test_id}",
            "paid_to": "Test Vendor"
        }
        
        response = self.session.post(f"{BASE_URL}/api/accounting/transactions", json=txn_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("approval_status") == "not_required", f"₹1000 should be petty cash, got {data.get('approval_status')}"
        assert data.get("needs_review") == False, f"₹1000 should not need review"
        
        print(f"✓ Boundary test (₹1000): approval_status={data.get('approval_status')}")
    
    # ============ MID-RANGE TRANSACTION TESTS (₹1001-5000) ============
    
    def test_mid_range_transaction_needs_review(self):
        """POST /api/accounting/transactions with amount 1001-5000 should have needs_review=true, approval_status=needs_review"""
        if not self.account_id or not self.category_id:
            pytest.skip("No account or category available for testing")
        
        test_id = uuid.uuid4().hex[:8]
        txn_data = {
            "transaction_date": datetime.now().isoformat(),
            "transaction_type": "outflow",
            "amount": 2500,  # Mid-range
            "mode": "cash",
            "category_id": self.category_id,
            "account_id": self.account_id,
            "remarks": f"TEST_mid_range_{test_id}",
            "paid_to": "Test Vendor"
        }
        
        response = self.session.post(f"{BASE_URL}/api/accounting/transactions", json=txn_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("needs_review") == True, f"Expected needs_review=True for ₹2500, got {data.get('needs_review')}"
        assert data.get("approval_status") == "needs_review", f"Expected approval_status=needs_review, got {data.get('approval_status')}"
        
        print(f"✓ Mid-range transaction (₹2500): needs_review={data.get('needs_review')}, approval_status={data.get('approval_status')}")
    
    def test_mid_range_boundary_1001(self):
        """POST /api/accounting/transactions with amount=1001 should trigger review flag"""
        if not self.account_id or not self.category_id:
            pytest.skip("No account or category available for testing")
        
        test_id = uuid.uuid4().hex[:8]
        txn_data = {
            "transaction_date": datetime.now().isoformat(),
            "transaction_type": "outflow",
            "amount": 1001,  # Just above petty cash
            "mode": "cash",
            "category_id": self.category_id,
            "account_id": self.account_id,
            "remarks": f"TEST_mid_boundary_low_{test_id}",
            "paid_to": "Test Vendor"
        }
        
        response = self.session.post(f"{BASE_URL}/api/accounting/transactions", json=txn_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("needs_review") == True, f"₹1001 should need review"
        assert data.get("approval_status") == "needs_review", f"₹1001 should have approval_status=needs_review"
        
        print(f"✓ Boundary test (₹1001): needs_review={data.get('needs_review')}")
    
    def test_mid_range_boundary_5000(self):
        """POST /api/accounting/transactions with amount=5000 should still be mid-range"""
        if not self.account_id or not self.category_id:
            pytest.skip("No account or category available for testing")
        
        test_id = uuid.uuid4().hex[:8]
        txn_data = {
            "transaction_date": datetime.now().isoformat(),
            "transaction_type": "outflow",
            "amount": 5000,  # Upper boundary of mid-range
            "mode": "cash",
            "category_id": self.category_id,
            "account_id": self.account_id,
            "remarks": f"TEST_mid_boundary_high_{test_id}",
            "paid_to": "Test Vendor"
        }
        
        response = self.session.post(f"{BASE_URL}/api/accounting/transactions", json=txn_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("needs_review") == True, f"₹5000 should need review"
        assert data.get("approval_status") == "needs_review", f"₹5000 should have approval_status=needs_review"
        
        print(f"✓ Boundary test (₹5000): needs_review={data.get('needs_review')}")
    
    # ============ HIGH VALUE TRANSACTION TESTS (>₹5000) ============
    
    def test_high_value_without_approver_flagged(self):
        """POST /api/accounting/transactions with amount >5000 without approver should be flagged"""
        if not self.account_id or not self.category_id:
            pytest.skip("No account or category available for testing")
        
        test_id = uuid.uuid4().hex[:8]
        txn_data = {
            "transaction_date": datetime.now().isoformat(),
            "transaction_type": "outflow",
            "amount": 7500,  # High value
            "mode": "cash",
            "category_id": self.category_id,
            "account_id": self.account_id,
            "remarks": f"TEST_high_value_no_approver_{test_id}",
            "paid_to": "Test Vendor"
        }
        
        response = self.session.post(f"{BASE_URL}/api/accounting/transactions", json=txn_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Should be allowed but flagged
        assert data.get("needs_review") == True, f"High value without approver should need review"
        assert data.get("approval_status") == "pending_approval", f"Expected approval_status=pending_approval, got {data.get('approval_status')}"
        
        print(f"✓ High value without approver (₹7500): approval_status={data.get('approval_status')}")
    
    def test_high_value_with_approver_approved(self):
        """POST /api/accounting/transactions with amount >5000 with approver should be approved"""
        if not self.account_id or not self.category_id:
            pytest.skip("No account or category available for testing")
        
        # Get an approver
        approvers_res = self.session.get(f"{BASE_URL}/api/accounting/users-for-approval")
        if approvers_res.status_code != 200 or not approvers_res.json():
            pytest.skip("No approvers available")
        
        approver = approvers_res.json()[0]
        
        test_id = uuid.uuid4().hex[:8]
        txn_data = {
            "transaction_date": datetime.now().isoformat(),
            "transaction_type": "outflow",
            "amount": 10000,  # High value
            "mode": "bank_transfer",
            "category_id": self.category_id,
            "account_id": self.account_id,
            "remarks": f"TEST_high_value_with_approver_{test_id}",
            "paid_to": "Test Vendor",
            "approved_by": approver["user_id"],
            "approved_by_name": approver["name"]
        }
        
        response = self.session.post(f"{BASE_URL}/api/accounting/transactions", json=txn_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("approval_status") == "approved", f"Expected approval_status=approved with approver, got {data.get('approval_status')}"
        assert data.get("approved_by") == approver["user_id"], "approved_by should match"
        assert data.get("approved_by_name") == approver["name"], "approved_by_name should match"
        
        print(f"✓ High value with approver (₹10000): approval_status={data.get('approval_status')}")
    
    def test_high_value_boundary_5001(self):
        """POST /api/accounting/transactions with amount=5001 should require approval"""
        if not self.account_id or not self.category_id:
            pytest.skip("No account or category available for testing")
        
        test_id = uuid.uuid4().hex[:8]
        txn_data = {
            "transaction_date": datetime.now().isoformat(),
            "transaction_type": "outflow",
            "amount": 5001,  # Just above review threshold
            "mode": "cash",
            "category_id": self.category_id,
            "account_id": self.account_id,
            "remarks": f"TEST_high_boundary_{test_id}",
            "paid_to": "Test Vendor"
        }
        
        response = self.session.post(f"{BASE_URL}/api/accounting/transactions", json=txn_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Without approver, should be pending_approval
        assert data.get("approval_status") == "pending_approval", f"₹5001 without approver should be pending_approval"
        assert data.get("needs_review") == True, f"₹5001 without approver should need review"
        
        print(f"✓ Boundary test (₹5001): approval_status={data.get('approval_status')}")
    
    # ============ MARK REVIEWED ENDPOINT TESTS ============
    
    def test_mark_reviewed_endpoint(self):
        """PUT /api/accounting/transactions/{id}/mark-reviewed marks transaction as reviewed"""
        if not self.account_id or not self.category_id:
            pytest.skip("No account or category available for testing")
        
        # First create a transaction that needs review
        test_id = uuid.uuid4().hex[:8]
        txn_data = {
            "transaction_date": datetime.now().isoformat(),
            "transaction_type": "outflow",
            "amount": 3000,  # Mid-range - needs review
            "mode": "cash",
            "category_id": self.category_id,
            "account_id": self.account_id,
            "remarks": f"TEST_mark_reviewed_{test_id}",
            "paid_to": "Test Vendor"
        }
        
        create_res = self.session.post(f"{BASE_URL}/api/accounting/transactions", json=txn_data)
        assert create_res.status_code == 200, f"Failed to create transaction: {create_res.text}"
        
        txn_id = create_res.json().get("transaction_id")
        assert txn_id, "Transaction ID not returned"
        
        # Verify it needs review
        assert create_res.json().get("needs_review") == True, "Transaction should need review"
        
        # Mark as reviewed
        review_res = self.session.put(f"{BASE_URL}/api/accounting/transactions/{txn_id}/mark-reviewed")
        
        assert review_res.status_code == 200, f"Expected 200, got {review_res.status_code}: {review_res.text}"
        data = review_res.json()
        
        assert data.get("needs_review") == False, "needs_review should be False after marking reviewed"
        assert data.get("approval_status") == "reviewed", f"approval_status should be 'reviewed', got {data.get('approval_status')}"
        assert data.get("reviewed_by") is not None, "reviewed_by should be set"
        assert data.get("reviewed_at") is not None, "reviewed_at should be set"
        
        print(f"✓ Mark reviewed: needs_review={data.get('needs_review')}, approval_status={data.get('approval_status')}")
    
    def test_mark_reviewed_nonexistent_transaction(self):
        """PUT /api/accounting/transactions/{id}/mark-reviewed with invalid ID returns 404"""
        response = self.session.put(f"{BASE_URL}/api/accounting/transactions/nonexistent_txn_123/mark-reviewed")
        
        assert response.status_code == 404, f"Expected 404 for nonexistent transaction, got {response.status_code}"
        print("✓ Mark reviewed nonexistent transaction returns 404")
    
    # ============ ACCOUNTABILITY FIELDS TESTS ============
    
    def test_transaction_includes_accountability_fields(self):
        """Transaction creation includes requested_by, paid_by, approved_by fields"""
        if not self.account_id or not self.category_id:
            pytest.skip("No account or category available for testing")
        
        test_id = uuid.uuid4().hex[:8]
        txn_data = {
            "transaction_date": datetime.now().isoformat(),
            "transaction_type": "outflow",
            "amount": 800,
            "mode": "cash",
            "category_id": self.category_id,
            "account_id": self.account_id,
            "remarks": f"TEST_accountability_{test_id}",
            "paid_to": "Test Vendor",
            "requested_by_name": "Custom Requester"
        }
        
        response = self.session.post(f"{BASE_URL}/api/accounting/transactions", json=txn_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify all accountability fields exist
        assert "requested_by" in data, "Missing requested_by field"
        assert "requested_by_name" in data, "Missing requested_by_name field"
        assert "paid_by" in data, "Missing paid_by field"
        assert "paid_by_name" in data, "Missing paid_by_name field"
        assert "approved_by" in data, "Missing approved_by field"
        assert "approved_by_name" in data, "Missing approved_by_name field"
        
        # Verify custom requested_by_name is used
        assert data.get("requested_by_name") == "Custom Requester", "Custom requested_by_name should be used"
        
        print(f"✓ Accountability fields present: requested_by={data.get('requested_by_name')}, paid_by={data.get('paid_by_name')}")
    
    # ============ INFLOW TRANSACTION TESTS ============
    
    def test_inflow_no_guardrails(self):
        """Inflow transactions should not have guardrails applied"""
        if not self.account_id or not self.category_id:
            pytest.skip("No account or category available for testing")
        
        test_id = uuid.uuid4().hex[:8]
        txn_data = {
            "transaction_date": datetime.now().isoformat(),
            "transaction_type": "inflow",
            "amount": 50000,  # Large inflow
            "mode": "bank_transfer",
            "category_id": self.category_id,
            "account_id": self.account_id,
            "remarks": f"TEST_inflow_{test_id}",
            "paid_to": "Client Payment"
        }
        
        response = self.session.post(f"{BASE_URL}/api/accounting/transactions", json=txn_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Inflows should not need review or approval
        assert data.get("needs_review") == False, "Inflow should not need review"
        assert data.get("approval_status") == "not_required", f"Inflow should have approval_status=not_required, got {data.get('approval_status')}"
        
        print(f"✓ Inflow (₹50000): no guardrails applied, approval_status={data.get('approval_status')}")
    
    # ============ UNAUTHENTICATED ACCESS TESTS ============
    
    def test_review_summary_unauthenticated(self):
        """Unauthenticated access to review-summary returns 401"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/accounting/transactions/review-summary")
        
        assert response.status_code == 401, f"Expected 401 for unauthenticated access, got {response.status_code}"
        print("✓ Review summary unauthenticated returns 401")
    
    def test_needs_review_unauthenticated(self):
        """Unauthenticated access to needs-review returns 401"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/accounting/transactions/needs-review")
        
        assert response.status_code == 401, f"Expected 401 for unauthenticated access, got {response.status_code}"
        print("✓ Needs review unauthenticated returns 401")
    
    def test_users_for_approval_unauthenticated(self):
        """Unauthenticated access to users-for-approval returns 401"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/accounting/users-for-approval")
        
        assert response.status_code == 401, f"Expected 401 for unauthenticated access, got {response.status_code}"
        print("✓ Users for approval unauthenticated returns 401")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
