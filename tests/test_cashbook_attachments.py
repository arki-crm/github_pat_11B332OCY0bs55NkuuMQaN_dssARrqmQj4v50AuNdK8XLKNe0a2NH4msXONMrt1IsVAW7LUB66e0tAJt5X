"""
Test CashBook Transaction Attachments Feature
Tests for:
1. CashBook Add Entry modal file upload
2. Transaction Details dialog with attachments
3. ProjectFinanceDetail clickable transactions
4. Attachment upload/download/delete APIs
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://moneymanager-146.preview.emergentagent.com')

@pytest.fixture(scope="module")
def session():
    """Create authenticated session"""
    s = requests.Session()
    
    # Setup local admin
    setup_resp = s.post(f"{BASE_URL}/api/auth/setup-local-admin")
    assert setup_resp.status_code == 200
    
    # Login - this sets the session cookie
    login_resp = s.post(f"{BASE_URL}/api/auth/local-login", json={
        "email": "thaha.pakayil@gmail.com",
        "password": "password123"
    })
    assert login_resp.status_code == 200
    
    # Verify session is working
    me_resp = s.get(f"{BASE_URL}/api/auth/me")
    assert me_resp.status_code == 200
    
    return s


class TestAttachmentAPIs:
    """Test attachment upload/download/delete APIs"""
    
    def test_upload_pdf_attachment(self, session):
        """Test uploading PDF attachment to cashbook entity"""
        # Create a test PDF file
        test_content = b"%PDF-1.4 test content"
        files = {"file": ("test_doc.pdf", test_content, "application/pdf")}
        
        entity_id = f"test_txn_{uuid.uuid4().hex[:8]}"
        
        response = session.post(
            f"{BASE_URL}/api/finance/attachments/upload",
            params={
                "entity_type": "cashbook",
                "entity_id": entity_id,
                "description": "Test PDF attachment"
            },
            files=files
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "attachment" in data
        assert data["attachment"]["entity_type"] == "cashbook"
        assert data["attachment"]["entity_id"] == entity_id
        assert data["attachment"]["mime_type"] == "application/pdf"
        
        # Store attachment_id for cleanup
        return data["attachment"]["attachment_id"]
    
    def test_upload_jpg_attachment(self, session):
        """Test uploading JPG attachment"""
        # Create a minimal JPEG file header
        test_content = b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00'
        files = {"file": ("test_image.jpg", test_content, "image/jpeg")}
        
        entity_id = f"test_txn_{uuid.uuid4().hex[:8]}"
        
        response = session.post(
            f"{BASE_URL}/api/finance/attachments/upload",
            params={
                "entity_type": "cashbook",
                "entity_id": entity_id,
                "description": "Test JPG attachment"
            },
            files=files
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["attachment"]["mime_type"] == "image/jpeg"
    
    def test_upload_png_attachment(self, session):
        """Test uploading PNG attachment"""
        # Create a minimal PNG file header
        test_content = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde'
        files = {"file": ("test_image.png", test_content, "image/png")}
        
        entity_id = f"test_txn_{uuid.uuid4().hex[:8]}"
        
        response = session.post(
            f"{BASE_URL}/api/finance/attachments/upload",
            params={
                "entity_type": "cashbook",
                "entity_id": entity_id,
                "description": "Test PNG attachment"
            },
            files=files
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["attachment"]["mime_type"] == "image/png"
    
    def test_upload_invalid_file_type_rejected(self, session):
        """Test that invalid file types are rejected"""
        test_content = b"This is a text file"
        files = {"file": ("test.txt", test_content, "text/plain")}
        
        response = session.post(
            f"{BASE_URL}/api/finance/attachments/upload",
            params={
                "entity_type": "cashbook",
                "entity_id": "test_txn_123",
                "description": "Invalid file"
            },
            files=files
        )
        
        assert response.status_code == 400
        assert "PDF, JPG, PNG" in response.json().get("detail", "")
    
    def test_list_attachments_for_entity(self, session):
        """Test listing attachments for a specific entity"""
        # First upload an attachment
        test_content = b"%PDF-1.4 test content"
        files = {"file": ("list_test.pdf", test_content, "application/pdf")}
        
        entity_id = f"list_test_{uuid.uuid4().hex[:8]}"
        
        upload_resp = session.post(
            f"{BASE_URL}/api/finance/attachments/upload",
            params={
                "entity_type": "cashbook",
                "entity_id": entity_id,
                "description": "List test attachment"
            },
            files=files
        )
        assert upload_resp.status_code == 200
        
        # Now list attachments
        list_resp = session.get(f"{BASE_URL}/api/finance/attachments/cashbook/{entity_id}")
        
        assert list_resp.status_code == 200
        data = list_resp.json()
        assert "attachments" in data
        assert len(data["attachments"]) >= 1
        assert data["attachments"][0]["entity_id"] == entity_id
    
    def test_download_attachment(self, session):
        """Test downloading an attachment"""
        # First upload an attachment
        test_content = b"%PDF-1.4 download test content"
        files = {"file": ("download_test.pdf", test_content, "application/pdf")}
        
        entity_id = f"download_test_{uuid.uuid4().hex[:8]}"
        
        upload_resp = session.post(
            f"{BASE_URL}/api/finance/attachments/upload",
            params={
                "entity_type": "cashbook",
                "entity_id": entity_id,
                "description": "Download test"
            },
            files=files
        )
        assert upload_resp.status_code == 200
        attachment_id = upload_resp.json()["attachment"]["attachment_id"]
        
        # Download the attachment
        download_resp = session.get(f"{BASE_URL}/api/finance/attachments/download/{attachment_id}")
        
        assert download_resp.status_code == 200
        assert len(download_resp.content) > 0
    
    def test_delete_attachment(self, session):
        """Test deleting an attachment"""
        # First upload an attachment
        test_content = b"%PDF-1.4 delete test content"
        files = {"file": ("delete_test.pdf", test_content, "application/pdf")}
        
        entity_id = f"delete_test_{uuid.uuid4().hex[:8]}"
        
        upload_resp = session.post(
            f"{BASE_URL}/api/finance/attachments/upload",
            params={
                "entity_type": "cashbook",
                "entity_id": entity_id,
                "description": "Delete test"
            },
            files=files
        )
        assert upload_resp.status_code == 200
        attachment_id = upload_resp.json()["attachment"]["attachment_id"]
        
        # Delete the attachment
        delete_resp = session.delete(f"{BASE_URL}/api/finance/attachments/{attachment_id}")
        
        assert delete_resp.status_code == 200
        
        # Verify it's deleted
        download_resp = session.get(f"{BASE_URL}/api/finance/attachments/download/{attachment_id}")
        assert download_resp.status_code == 404


class TestCashBookTransactions:
    """Test CashBook transaction APIs with attachment support"""
    
    def test_create_transaction_returns_transaction_id(self, session):
        """Test that creating a transaction returns transaction_id for attachment linking"""
        # Get accounts and categories first
        accounts_resp = session.get(f"{BASE_URL}/api/accounting/accounts")
        assert accounts_resp.status_code == 200
        accounts = accounts_resp.json()
        
        categories_resp = session.get(f"{BASE_URL}/api/accounting/categories")
        assert categories_resp.status_code == 200
        categories = categories_resp.json()
        
        if not accounts or not categories:
            pytest.skip("No accounts or categories available")
        
        # Create a transaction
        txn_data = {
            "transaction_type": "outflow",
            "amount": 100,
            "mode": "cash",
            "category_id": categories[0]["category_id"],
            "account_id": accounts[0]["account_id"],
            "remarks": f"TEST_attachment_link_{uuid.uuid4().hex[:8]}",
            "transaction_date": datetime.now().isoformat()
        }
        
        response = session.post(f"{BASE_URL}/api/accounting/transactions", json=txn_data)
        
        assert response.status_code == 200
        data = response.json()
        assert "transaction_id" in data
        assert data["transaction_id"].startswith("txn_")
        
        return data["transaction_id"]
    
    def test_get_transactions_includes_docs_column_data(self, session):
        """Test that transactions list includes data needed for Docs column"""
        today = datetime.now().strftime("%Y-%m-%d")
        
        response = session.get(f"{BASE_URL}/api/accounting/transactions?date={today}")
        
        assert response.status_code == 200
        transactions = response.json()
        
        if len(transactions) > 0:
            txn = transactions[0]
            # Verify transaction has required fields
            assert "transaction_id" in txn
            assert "transaction_type" in txn
            assert "amount" in txn
            assert "remarks" in txn


class TestProjectFinanceTransactions:
    """Test ProjectFinanceDetail transaction view"""
    
    def test_project_finance_includes_transactions(self, session):
        """Test that project finance detail includes transactions"""
        # Get list of projects
        projects_resp = session.get(f"{BASE_URL}/api/finance/project-finance")
        assert projects_resp.status_code == 200
        projects = projects_resp.json()
        
        if not projects:
            pytest.skip("No projects available")
        
        # Get first project with transactions
        project_id = projects[0]["project_id"]
        
        detail_resp = session.get(f"{BASE_URL}/api/finance/project-finance/{project_id}")
        
        assert detail_resp.status_code == 200
        data = detail_resp.json()
        
        # Verify structure includes transactions
        assert "transactions" in data
        
        if len(data["transactions"]) > 0:
            txn = data["transactions"][0]
            assert "transaction_id" in txn


class TestAttachmentPermissions:
    """Test attachment permission checks"""
    
    def test_unauthenticated_upload_rejected(self):
        """Test that unauthenticated upload is rejected"""
        s = requests.Session()
        
        test_content = b"%PDF-1.4 test"
        files = {"file": ("test.pdf", test_content, "application/pdf")}
        
        response = s.post(
            f"{BASE_URL}/api/finance/attachments/upload",
            params={
                "entity_type": "cashbook",
                "entity_id": "test_123",
                "description": "Test"
            },
            files=files
        )
        
        assert response.status_code == 401
    
    def test_unauthenticated_list_rejected(self):
        """Test that unauthenticated list is rejected"""
        s = requests.Session()
        
        response = s.get(f"{BASE_URL}/api/finance/attachments/cashbook/test_123")
        
        assert response.status_code == 401
    
    def test_unauthenticated_download_rejected(self):
        """Test that unauthenticated download is rejected"""
        s = requests.Session()
        
        response = s.get(f"{BASE_URL}/api/finance/attachments/download/att_test123")
        
        assert response.status_code == 401


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
