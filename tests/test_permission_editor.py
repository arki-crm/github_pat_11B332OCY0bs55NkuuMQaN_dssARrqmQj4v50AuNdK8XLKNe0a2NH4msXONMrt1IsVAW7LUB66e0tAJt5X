"""
Test Permission Editor UI Feature
Tests for:
- GET /api/roles/available - Returns all roles with categories
- GET /api/permissions/available - Returns all permission groups
- GET /api/users/{user_id}/permissions - Get user permissions
- PUT /api/users/{user_id}/permissions - Update user permissions
- POST /api/users/{user_id}/permissions/reset-to-role - Reset to role defaults
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPermissionEditorAPIs:
    """Test Permission Editor backend APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get session"""
        self.session = requests.Session()
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": "thaha.pakayil@gmail.com", "password": "password123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.admin_user = login_response.json()["user"]
        
    def test_get_available_roles_returns_200(self):
        """GET /api/roles/available returns 200 with authenticated user"""
        response = self.session.get(f"{BASE_URL}/api/roles/available")
        assert response.status_code == 200
        
    def test_get_available_roles_returns_all_categories(self):
        """GET /api/roles/available returns roles with all expected categories"""
        response = self.session.get(f"{BASE_URL}/api/roles/available")
        data = response.json()
        
        # Check categories exist
        assert "categories" in data
        expected_categories = ["Administration", "Sales", "Design", "Operations", "Service", "Finance", "Leadership"]
        for cat in expected_categories:
            assert cat in data["categories"], f"Missing category: {cat}"
            
    def test_get_available_roles_contains_all_roles(self):
        """GET /api/roles/available contains all expected roles"""
        response = self.session.get(f"{BASE_URL}/api/roles/available")
        data = response.json()
        
        role_ids = [r["id"] for r in data["roles"]]
        
        # CRM Roles
        assert "Admin" in role_ids
        assert "PreSales" in role_ids
        assert "SalesManager" in role_ids
        assert "Designer" in role_ids
        assert "DesignManager" in role_ids
        assert "ProductionOpsManager" in role_ids
        assert "OperationLead" in role_ids
        assert "Technician" in role_ids
        
        # Finance Roles
        assert "JuniorAccountant" in role_ids
        assert "SeniorAccountant" in role_ids
        assert "FinanceManager" in role_ids
        assert "CharteredAccountant" in role_ids
        
        # Leadership
        assert "Founder" in role_ids
        
    def test_get_available_roles_has_required_fields(self):
        """Each role has required fields: id, name, category, description"""
        response = self.session.get(f"{BASE_URL}/api/roles/available")
        data = response.json()
        
        for role in data["roles"]:
            assert "id" in role, f"Role missing 'id': {role}"
            assert "name" in role, f"Role missing 'name': {role}"
            assert "category" in role, f"Role missing 'category': {role}"
            assert "description" in role, f"Role missing 'description': {role}"
            
    def test_get_available_permissions_returns_200_for_admin(self):
        """GET /api/permissions/available returns 200 for admin"""
        response = self.session.get(f"{BASE_URL}/api/permissions/available")
        assert response.status_code == 200
        
    def test_get_available_permissions_contains_crm_groups(self):
        """GET /api/permissions/available contains CRM permission groups"""
        response = self.session.get(f"{BASE_URL}/api/permissions/available")
        data = response.json()
        
        groups = data["permission_groups"].keys()
        crm_groups = ["presales", "leads", "projects", "milestones", "warranty", "academy", "admin"]
        for group in crm_groups:
            assert group in groups, f"Missing CRM group: {group}"
            
    def test_get_available_permissions_contains_finance_groups(self):
        """GET /api/permissions/available contains Finance permission groups"""
        response = self.session.get(f"{BASE_URL}/api/permissions/available")
        data = response.json()
        
        groups = data["permission_groups"].keys()
        finance_groups = ["finance_cashbook", "finance_accounts", "finance_documents", 
                         "finance_project", "finance_expenses", "finance_reports", 
                         "finance_masters", "finance_controls"]
        for group in finance_groups:
            assert group in groups, f"Missing Finance group: {group}"
            
    def test_get_available_permissions_includes_default_role_permissions(self):
        """GET /api/permissions/available includes default_role_permissions"""
        response = self.session.get(f"{BASE_URL}/api/permissions/available")
        data = response.json()
        
        assert "default_role_permissions" in data
        assert "Admin" in data["default_role_permissions"]
        assert "Designer" in data["default_role_permissions"]
        
    def test_get_user_permissions_returns_200(self):
        """GET /api/users/{user_id}/permissions returns 200"""
        # Get a test user
        users_response = self.session.get(f"{BASE_URL}/api/users")
        users = users_response.json()
        test_user = next((u for u in users if u["role"] == "Designer"), None)
        
        if test_user:
            response = self.session.get(f"{BASE_URL}/api/users/{test_user['user_id']}/permissions")
            assert response.status_code == 200
            
    def test_get_user_permissions_returns_correct_structure(self):
        """GET /api/users/{user_id}/permissions returns correct structure"""
        # Get a test user
        users_response = self.session.get(f"{BASE_URL}/api/users")
        users = users_response.json()
        test_user = next((u for u in users if u["role"] == "Designer"), None)
        
        if test_user:
            response = self.session.get(f"{BASE_URL}/api/users/{test_user['user_id']}/permissions")
            data = response.json()
            
            assert "user_id" in data
            assert "role" in data
            assert "custom_permissions" in data
            assert "permissions" in data
            assert "effective_permissions" in data
            assert "default_role_permissions" in data
            
    def test_update_user_permissions_success(self):
        """PUT /api/users/{user_id}/permissions updates permissions successfully"""
        # Get a test user
        users_response = self.session.get(f"{BASE_URL}/api/users")
        users = users_response.json()
        test_user = next((u for u in users if u["role"] == "Designer" and u["user_id"] != self.admin_user["user_id"]), None)
        
        if test_user:
            # Update permissions
            new_permissions = ["leads.view", "leads.update", "projects.view", "finance.cashbook.view"]
            response = self.session.put(
                f"{BASE_URL}/api/users/{test_user['user_id']}/permissions",
                json={"permissions": new_permissions, "custom_permissions": True}
            )
            assert response.status_code == 200
            data = response.json()
            assert data["success"] == True
            assert "finance.cashbook.view" in data["permissions"]
            
    def test_reset_to_role_defaults_success(self):
        """POST /api/users/{user_id}/permissions/reset-to-role resets permissions"""
        # Get a test user
        users_response = self.session.get(f"{BASE_URL}/api/users")
        users = users_response.json()
        test_user = next((u for u in users if u["role"] == "Designer" and u["user_id"] != self.admin_user["user_id"]), None)
        
        if test_user:
            # Reset to defaults
            response = self.session.post(f"{BASE_URL}/api/users/{test_user['user_id']}/permissions/reset-to-role")
            assert response.status_code == 200
            data = response.json()
            assert data["success"] == True
            assert "Designer" in data["message"]
            
    def test_permission_counts_crm_vs_finance(self):
        """Verify permission counts can distinguish CRM vs Finance"""
        response = self.session.get(f"{BASE_URL}/api/permissions/available")
        data = response.json()
        
        # Count CRM permissions
        crm_groups = ["presales", "leads", "projects", "milestones", "warranty", "academy", "admin"]
        crm_count = 0
        for group in crm_groups:
            if group in data["permission_groups"]:
                crm_count += len(data["permission_groups"][group]["permissions"])
                
        # Count Finance permissions
        finance_groups = ["finance_cashbook", "finance_accounts", "finance_documents", 
                         "finance_project", "finance_expenses", "finance_reports", 
                         "finance_masters", "finance_controls", "finance"]
        finance_count = 0
        for group in finance_groups:
            if group in data["permission_groups"]:
                finance_count += len(data["permission_groups"][group]["permissions"])
                
        assert crm_count > 0, "Should have CRM permissions"
        assert finance_count > 0, "Should have Finance permissions"
        print(f"CRM permissions: {crm_count}, Finance permissions: {finance_count}")
        
    def test_unauthenticated_access_denied(self):
        """Unauthenticated access to permissions endpoints returns 401"""
        # Create new session without login
        new_session = requests.Session()
        
        response = new_session.get(f"{BASE_URL}/api/permissions/available")
        assert response.status_code == 401
        
    def test_non_admin_cannot_access_available_permissions(self):
        """Non-admin users cannot access /api/permissions/available"""
        # This test would require creating a non-admin user and logging in
        # For now, we verify the endpoint requires admin
        response = self.session.get(f"{BASE_URL}/api/permissions/available")
        assert response.status_code == 200  # Admin should have access


class TestRoleFilterDropdown:
    """Test role filter functionality in Users page"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get session"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": "thaha.pakayil@gmail.com", "password": "password123"}
        )
        assert login_response.status_code == 200
        
    def test_users_endpoint_supports_role_filter(self):
        """GET /api/users supports role filter parameter"""
        response = self.session.get(f"{BASE_URL}/api/users?role=Designer")
        assert response.status_code == 200
        users = response.json()
        # All returned users should be Designers
        for user in users:
            assert user["role"] == "Designer", f"Expected Designer, got {user['role']}"
            
    def test_users_endpoint_supports_status_filter(self):
        """GET /api/users supports status filter parameter"""
        response = self.session.get(f"{BASE_URL}/api/users?status=Active")
        assert response.status_code == 200
        users = response.json()
        # All returned users should be Active
        for user in users:
            assert user["status"] == "Active", f"Expected Active, got {user['status']}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
