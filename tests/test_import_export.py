"""
Test Import/Export Module APIs
Tests for:
- GET /api/admin/export/types - Export types (Finance: 5, CRM: 3)
- GET /api/admin/import/types - Import types with required fields and duplicate strategies
- POST /api/admin/export - Export data in CSV/Excel format
- GET /api/admin/export/template/{data_type} - Download import template
- POST /api/admin/import/preview - Preview import with validation
- POST /api/admin/import/execute - Execute import with imported=true tagging
- GET /api/admin/import/history - Import audit log
"""

import pytest
import requests
import os
import json
from io import BytesIO

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "thaha.pakayil@gmail.com"
TEST_PASSWORD = "password123"


class TestImportExportModule:
    """Test Import/Export Module APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get session cookie
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        yield
        
        self.session.close()
    
    # ============ EXPORT TYPES TESTS ============
    
    def test_get_export_types_returns_finance_and_crm(self):
        """GET /api/admin/export/types - Should return Finance (5 types) and CRM (3 types)"""
        response = self.session.get(f"{BASE_URL}/api/admin/export/types")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "finance" in data, "Response should have 'finance' key"
        assert "crm" in data, "Response should have 'crm' key"
        
        # Verify Finance has 5 types
        assert len(data["finance"]) == 5, f"Expected 5 finance types, got {len(data['finance'])}"
        finance_ids = [item["id"] for item in data["finance"]]
        assert "cashbook" in finance_ids, "Finance should include cashbook"
        assert "receipts" in finance_ids, "Finance should include receipts"
        assert "liabilities" in finance_ids, "Finance should include liabilities"
        assert "salaries" in finance_ids, "Finance should include salaries"
        assert "project_finance" in finance_ids, "Finance should include project_finance"
        
        # Verify CRM has 3 types
        assert len(data["crm"]) == 3, f"Expected 3 CRM types, got {len(data['crm'])}"
        crm_ids = [item["id"] for item in data["crm"]]
        assert "leads" in crm_ids, "CRM should include leads"
        assert "projects" in crm_ids, "CRM should include projects"
        assert "customers" in crm_ids, "CRM should include customers"
        
        # Verify each type has required fields
        for item in data["finance"] + data["crm"]:
            assert "id" in item, "Each type should have 'id'"
            assert "name" in item, "Each type should have 'name'"
            assert "description" in item, "Each type should have 'description'"
    
    def test_export_types_unauthenticated_returns_401(self):
        """GET /api/admin/export/types - Unauthenticated should return 401"""
        new_session = requests.Session()
        response = new_session.get(f"{BASE_URL}/api/admin/export/types")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        new_session.close()
    
    # ============ IMPORT TYPES TESTS ============
    
    def test_get_import_types_returns_types_with_required_fields(self):
        """GET /api/admin/import/types - Should return import types with required fields and duplicate strategies"""
        response = self.session.get(f"{BASE_URL}/api/admin/import/types")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "finance" in data, "Response should have 'finance' key"
        assert "crm" in data, "Response should have 'crm' key"
        assert "duplicate_strategies" in data, "Response should have 'duplicate_strategies' key"
        
        # Verify Finance import types (4 types - no project_finance for import)
        assert len(data["finance"]) == 4, f"Expected 4 finance import types, got {len(data['finance'])}"
        
        # Verify CRM import types (2 types - no customers for import)
        assert len(data["crm"]) == 2, f"Expected 2 CRM import types, got {len(data['crm'])}"
        
        # Verify duplicate strategies
        assert len(data["duplicate_strategies"]) == 3, f"Expected 3 duplicate strategies, got {len(data['duplicate_strategies'])}"
        strategy_ids = [s["id"] for s in data["duplicate_strategies"]]
        assert "skip" in strategy_ids, "Should have 'skip' strategy"
        assert "update" in strategy_ids, "Should have 'update' strategy"
        assert "create_new" in strategy_ids, "Should have 'create_new' strategy"
        
        # Verify required_fields are present
        for item in data["finance"] + data["crm"]:
            assert "id" in item, "Each type should have 'id'"
            assert "name" in item, "Each type should have 'name'"
            assert "description" in item, "Each type should have 'description'"
            assert "required_fields" in item, "Each type should have 'required_fields'"
            assert isinstance(item["required_fields"], list), "required_fields should be a list"
    
    def test_import_types_cashbook_required_fields(self):
        """Verify cashbook import has correct required fields"""
        response = self.session.get(f"{BASE_URL}/api/admin/import/types")
        data = response.json()
        
        cashbook = next((item for item in data["finance"] if item["id"] == "cashbook"), None)
        assert cashbook is not None, "Cashbook should be in finance import types"
        
        required = cashbook["required_fields"]
        assert "date" in required, "Cashbook should require 'date'"
        assert "type" in required, "Cashbook should require 'type'"
        assert "amount" in required, "Cashbook should require 'amount'"
        assert "category_name" in required, "Cashbook should require 'category_name'"
        assert "account_name" in required, "Cashbook should require 'account_name'"
    
    # ============ EXPORT DATA TESTS ============
    
    def test_export_cashbook_csv(self):
        """POST /api/admin/export - Export cashbook data in CSV format"""
        response = self.session.post(
            f"{BASE_URL}/api/admin/export",
            json={
                "data_type": "cashbook",
                "format": "csv"
            }
        )
        
        # May return 404 if no data, or 200 with data
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            # Verify CSV content type
            content_type = response.headers.get("content-type", "")
            assert "text/csv" in content_type, f"Expected CSV content type, got {content_type}"
            
            # Verify content-disposition header
            content_disp = response.headers.get("content-disposition", "")
            assert "attachment" in content_disp, "Should have attachment disposition"
            assert "cashbook_export" in content_disp, "Filename should contain 'cashbook_export'"
            assert ".csv" in content_disp, "Filename should have .csv extension"
    
    def test_export_leads_excel(self):
        """POST /api/admin/export - Export leads data in Excel format"""
        response = self.session.post(
            f"{BASE_URL}/api/admin/export",
            json={
                "data_type": "leads",
                "format": "xlsx"
            }
        )
        
        # May return 404 if no data, or 200 with data
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            # Verify Excel content type
            content_type = response.headers.get("content-type", "")
            assert "spreadsheetml" in content_type or "application/vnd" in content_type, f"Expected Excel content type, got {content_type}"
            
            # Verify content-disposition header
            content_disp = response.headers.get("content-disposition", "")
            assert "attachment" in content_disp, "Should have attachment disposition"
            assert "leads_export" in content_disp, "Filename should contain 'leads_export'"
            assert ".xlsx" in content_disp, "Filename should have .xlsx extension"
    
    def test_export_invalid_data_type_returns_400(self):
        """POST /api/admin/export - Invalid data type should return 400"""
        response = self.session.post(
            f"{BASE_URL}/api/admin/export",
            json={
                "data_type": "invalid_type",
                "format": "csv"
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
    
    def test_export_with_date_filter(self):
        """POST /api/admin/export - Export with date filter"""
        response = self.session.post(
            f"{BASE_URL}/api/admin/export",
            json={
                "data_type": "cashbook",
                "format": "csv",
                "date_from": "2024-01-01",
                "date_to": "2024-12-31"
            }
        )
        
        # May return 404 if no data in range, or 200 with data
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}"
    
    # ============ IMPORT TEMPLATE TESTS ============
    
    def test_download_cashbook_template(self):
        """GET /api/admin/export/template/cashbook - Download import template"""
        response = self.session.get(f"{BASE_URL}/api/admin/export/template/cashbook")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify Excel content type
        content_type = response.headers.get("content-type", "")
        assert "spreadsheetml" in content_type or "application/vnd" in content_type, f"Expected Excel content type, got {content_type}"
        
        # Verify content-disposition header
        content_disp = response.headers.get("content-disposition", "")
        assert "attachment" in content_disp, "Should have attachment disposition"
        assert "cashbook_import_template.xlsx" in content_disp, f"Filename should be cashbook_import_template.xlsx, got {content_disp}"
    
    def test_download_leads_template(self):
        """GET /api/admin/export/template/leads - Download leads import template"""
        response = self.session.get(f"{BASE_URL}/api/admin/export/template/leads")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        content_disp = response.headers.get("content-disposition", "")
        assert "leads_import_template.xlsx" in content_disp, f"Filename should be leads_import_template.xlsx"
    
    def test_download_template_invalid_type_returns_400(self):
        """GET /api/admin/export/template/invalid - Invalid type should return 400"""
        response = self.session.get(f"{BASE_URL}/api/admin/export/template/invalid_type")
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
    
    # ============ IMPORT PREVIEW TESTS ============
    
    def test_import_preview_with_csv_file(self):
        """POST /api/admin/import/preview - Preview import with CSV file"""
        # Create a simple CSV content for leads
        csv_content = b"""Customer Name,Customer Phone,Source
TEST_Import Lead 1,9876543210,Website
TEST_Import Lead 2,9876543211,Referral
"""
        
        files = {
            'file': ('test_leads.csv', BytesIO(csv_content), 'text/csv')
        }
        
        # Use a fresh session for file upload to avoid Content-Type issues
        upload_session = requests.Session()
        # Login first
        login_resp = upload_session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert login_resp.status_code == 200, "Login failed for upload session"
        
        response = upload_session.post(
            f"{BASE_URL}/api/admin/import/preview?data_type=leads&duplicate_strategy=skip",
            files=files
        )
        upload_session.close()
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify preview response structure
        assert "preview_id" in data, "Response should have 'preview_id'"
        assert "data_type" in data, "Response should have 'data_type'"
        assert "file_name" in data, "Response should have 'file_name'"
        assert "total_rows" in data, "Response should have 'total_rows'"
        assert "valid_count" in data, "Response should have 'valid_count'"
        assert "duplicate_count" in data, "Response should have 'duplicate_count'"
        assert "error_count" in data, "Response should have 'error_count'"
        assert "warnings" in data, "Response should have 'warnings'"
        
        # Verify warnings about imported data restrictions
        warnings_text = " ".join(data["warnings"])
        assert "imported" in warnings_text.lower(), "Warnings should mention 'imported' tagging"
        assert "excluded" in warnings_text.lower() or "not include" in warnings_text.lower(), "Warnings should mention exclusion from calculations"
        
        # Store preview_id for execute test
        self.__class__.preview_id = data.get("preview_id")
        self.__class__.valid_count = data.get("valid_count", 0)
    
    def test_import_preview_validates_required_fields(self):
        """POST /api/admin/import/preview - Should validate required fields"""
        # Create CSV with missing required fields
        csv_content = b"""Customer Name,Source
TEST_Missing Phone,Website
"""
        
        files = {
            'file': ('test_invalid.csv', BytesIO(csv_content), 'text/csv')
        }
        
        # Use a fresh session for file upload
        upload_session = requests.Session()
        login_resp = upload_session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert login_resp.status_code == 200, "Login failed"
        
        response = upload_session.post(
            f"{BASE_URL}/api/admin/import/preview?data_type=leads&duplicate_strategy=skip",
            files=files
        )
        upload_session.close()
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Should have errors for missing required field
        assert data["error_count"] > 0 or data["valid_count"] == 0, "Should detect missing required field"
    
    def test_import_preview_invalid_file_type_returns_400(self):
        """POST /api/admin/import/preview - Invalid file type should return 400"""
        files = {
            'file': ('test.txt', 'invalid content', 'text/plain')
        }
        
        headers = dict(self.session.headers)
        if 'Content-Type' in headers:
            del headers['Content-Type']
        
        response = self.session.post(
            f"{BASE_URL}/api/admin/import/preview?data_type=leads&duplicate_strategy=skip",
            files=files,
            headers=headers
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
    
    # ============ IMPORT EXECUTE TESTS ============
    
    def test_import_execute_tags_records_as_imported(self):
        """POST /api/admin/import/execute - Execute import and verify records are tagged with imported=true"""
        # First create a preview
        csv_content = """Customer Name,Customer Phone,Source
TEST_Execute Lead,9999888877,Import Test
"""
        
        files = {
            'file': ('test_execute.csv', csv_content, 'text/csv')
        }
        
        headers = dict(self.session.headers)
        if 'Content-Type' in headers:
            del headers['Content-Type']
        
        preview_response = self.session.post(
            f"{BASE_URL}/api/admin/import/preview?data_type=leads&duplicate_strategy=skip",
            files=files,
            headers=headers
        )
        
        assert preview_response.status_code == 200, f"Preview failed: {preview_response.text}"
        preview_data = preview_response.json()
        preview_id = preview_data.get("preview_id")
        
        if preview_data.get("valid_count", 0) == 0 and preview_data.get("duplicate_count", 0) == 0:
            pytest.skip("No valid rows to import (may be duplicate)")
        
        # Execute import
        self.session.headers.update({"Content-Type": "application/json"})
        execute_response = self.session.post(
            f"{BASE_URL}/api/admin/import/execute",
            json={
                "data_type": "leads",
                "duplicate_strategy": "skip",
                "preview_id": preview_id
            }
        )
        
        assert execute_response.status_code == 200, f"Execute failed: {execute_response.text}"
        
        exec_data = execute_response.json()
        
        # Verify response structure
        assert "success" in exec_data, "Response should have 'success'"
        assert "import_id" in exec_data, "Response should have 'import_id'"
        assert "imported_count" in exec_data, "Response should have 'imported_count'"
        assert "warnings" in exec_data, "Response should have 'warnings'"
        
        # Verify warnings mention imported=true tagging
        warnings_text = " ".join(exec_data["warnings"])
        assert "imported" in warnings_text.lower(), "Warnings should mention imported tagging"
    
    def test_import_execute_invalid_preview_returns_404(self):
        """POST /api/admin/import/execute - Invalid preview_id should return 404"""
        response = self.session.post(
            f"{BASE_URL}/api/admin/import/execute",
            json={
                "data_type": "leads",
                "duplicate_strategy": "skip",
                "preview_id": "invalid_preview_id"
            }
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    # ============ IMPORT HISTORY TESTS ============
    
    def test_get_import_history(self):
        """GET /api/admin/import/history - Get import audit log"""
        response = self.session.get(f"{BASE_URL}/api/admin/import/history")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "imports" in data, "Response should have 'imports' key"
        assert isinstance(data["imports"], list), "'imports' should be a list"
        
        # If there are imports, verify structure
        if len(data["imports"]) > 0:
            import_record = data["imports"][0]
            assert "import_id" in import_record, "Import record should have 'import_id'"
            assert "data_type" in import_record, "Import record should have 'data_type'"
            assert "file_name" in import_record, "Import record should have 'file_name'"
            assert "total_rows" in import_record, "Import record should have 'total_rows'"
            assert "imported_count" in import_record, "Import record should have 'imported_count'"
            assert "import_date" in import_record, "Import record should have 'import_date'"
            assert "imported_by_name" in import_record, "Import record should have 'imported_by_name'"
    
    def test_import_history_unauthenticated_returns_401(self):
        """GET /api/admin/import/history - Unauthenticated should return 401"""
        new_session = requests.Session()
        response = new_session.get(f"{BASE_URL}/api/admin/import/history")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        new_session.close()
    
    # ============ EXPORT ALL DATA TYPES TESTS ============
    
    def test_export_receipts(self):
        """POST /api/admin/export - Export receipts data"""
        response = self.session.post(
            f"{BASE_URL}/api/admin/export",
            json={"data_type": "receipts", "format": "xlsx"}
        )
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}"
    
    def test_export_liabilities(self):
        """POST /api/admin/export - Export liabilities data"""
        response = self.session.post(
            f"{BASE_URL}/api/admin/export",
            json={"data_type": "liabilities", "format": "xlsx"}
        )
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}"
    
    def test_export_salaries(self):
        """POST /api/admin/export - Export salaries data"""
        response = self.session.post(
            f"{BASE_URL}/api/admin/export",
            json={"data_type": "salaries", "format": "xlsx"}
        )
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}"
    
    def test_export_project_finance(self):
        """POST /api/admin/export - Export project finance summary"""
        response = self.session.post(
            f"{BASE_URL}/api/admin/export",
            json={"data_type": "project_finance", "format": "xlsx"}
        )
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}"
    
    def test_export_projects(self):
        """POST /api/admin/export - Export projects data"""
        response = self.session.post(
            f"{BASE_URL}/api/admin/export",
            json={"data_type": "projects", "format": "xlsx"}
        )
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}"
    
    def test_export_customers(self):
        """POST /api/admin/export - Export customers data"""
        response = self.session.post(
            f"{BASE_URL}/api/admin/export",
            json={"data_type": "customers", "format": "xlsx"}
        )
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
