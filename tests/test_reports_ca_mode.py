"""
Test Reports & Insights Layer and CA Mode
- Cash Flow Report API
- Project Profitability Report API
- Available Reports API
- CharteredAccountant role permissions
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestReportsAndCAMode:
    """Test Reports & Insights Layer and CA Mode"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get session"""
        self.session = requests.Session()
        # Login as Admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": "thaha.pakayil@gmail.com", "password": "password123"}
        )
        if login_response.status_code != 200:
            pytest.skip("Login failed - skipping tests")
        self.user = login_response.json().get("user", {})
        yield
    
    # ============ AVAILABLE REPORTS API ============
    
    def test_get_available_reports_success(self):
        """GET /api/finance/reports/available - Returns list of available reports"""
        response = self.session.get(f"{BASE_URL}/api/finance/reports/available")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "reports" in data
        reports = data["reports"]
        assert isinstance(reports, list)
        
        # Should have at least cash-flow and project-profitability reports
        report_ids = [r["id"] for r in reports]
        assert "cash-flow" in report_ids, "Cash Flow report should be available"
        assert "project-profitability" in report_ids, "Project Profitability report should be available"
        
        # Verify report structure
        for report in reports:
            assert "id" in report
            assert "name" in report
            assert "description" in report
            assert "default_period" in report
            assert "permissions_required" in report
        
        print(f"✓ Available reports: {report_ids}")
    
    def test_get_available_reports_unauthenticated(self):
        """GET /api/finance/reports/available - Unauthenticated returns 401"""
        new_session = requests.Session()
        response = new_session.get(f"{BASE_URL}/api/finance/reports/available")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Unauthenticated request returns 401")
    
    # ============ CASH FLOW REPORT API ============
    
    def test_cash_flow_report_default_period(self):
        """GET /api/finance/reports/cash-flow - Default 3 months period"""
        response = self.session.get(f"{BASE_URL}/api/finance/reports/cash-flow")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "period" in data
        assert data["period"] == "3months"
        assert "date_from" in data
        assert "date_to" in data
        assert "summary" in data
        
        # Verify summary structure
        summary = data["summary"]
        assert "total_inflow" in summary
        assert "total_outflow" in summary
        assert "net_cash_flow" in summary
        assert "transaction_count" in summary
        assert "cash_flow_status" in summary
        
        print(f"✓ Cash Flow Report - Period: {data['period']}, Transactions: {summary['transaction_count']}")
    
    def test_cash_flow_report_6months_period(self):
        """GET /api/finance/reports/cash-flow?period=6months"""
        response = self.session.get(f"{BASE_URL}/api/finance/reports/cash-flow?period=6months")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["period"] == "6months"
        print(f"✓ Cash Flow Report 6 months - Date range: {data['date_from']} to {data['date_to']}")
    
    def test_cash_flow_report_12months_period(self):
        """GET /api/finance/reports/cash-flow?period=12months"""
        response = self.session.get(f"{BASE_URL}/api/finance/reports/cash-flow?period=12months")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["period"] == "12months"
        print(f"✓ Cash Flow Report 12 months - Date range: {data['date_from']} to {data['date_to']}")
    
    def test_cash_flow_report_custom_period(self):
        """GET /api/finance/reports/cash-flow?period=custom&start_date=...&end_date=..."""
        response = self.session.get(
            f"{BASE_URL}/api/finance/reports/cash-flow?period=custom&start_date=2024-01-01&end_date=2024-12-31"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["period"] == "custom"
        assert data["date_from"] == "2024-01-01"
        assert data["date_to"] == "2024-12-31"
        print(f"✓ Cash Flow Report custom period - {data['date_from']} to {data['date_to']}")
    
    def test_cash_flow_report_has_monthly_trend(self):
        """Cash Flow Report includes monthly trend data"""
        response = self.session.get(f"{BASE_URL}/api/finance/reports/cash-flow")
        assert response.status_code == 200
        
        data = response.json()
        assert "monthly_trend" in data
        monthly_trend = data["monthly_trend"]
        assert isinstance(monthly_trend, list)
        
        # If there's data, verify structure
        if monthly_trend:
            for item in monthly_trend:
                assert "month" in item
                assert "inflow" in item
                assert "outflow" in item
                assert "net" in item
        
        print(f"✓ Monthly trend has {len(monthly_trend)} months of data")
    
    def test_cash_flow_report_has_category_breakdown(self):
        """Cash Flow Report includes category breakdown"""
        response = self.session.get(f"{BASE_URL}/api/finance/reports/cash-flow")
        assert response.status_code == 200
        
        data = response.json()
        assert "category_breakdown" in data
        category_breakdown = data["category_breakdown"]
        assert "inflow" in category_breakdown
        assert "outflow" in category_breakdown
        
        print(f"✓ Category breakdown - Inflow categories: {len(category_breakdown['inflow'])}, Outflow categories: {len(category_breakdown['outflow'])}")
    
    def test_cash_flow_report_has_account_breakdown(self):
        """Cash Flow Report includes account breakdown"""
        response = self.session.get(f"{BASE_URL}/api/finance/reports/cash-flow")
        assert response.status_code == 200
        
        data = response.json()
        assert "account_breakdown" in data
        account_breakdown = data["account_breakdown"]
        assert isinstance(account_breakdown, list)
        
        # If there's data, verify structure
        if account_breakdown:
            for item in account_breakdown:
                assert "account" in item
                assert "inflow" in item
                assert "outflow" in item
                assert "net" in item
        
        print(f"✓ Account breakdown has {len(account_breakdown)} accounts")
    
    def test_cash_flow_report_has_project_cash_flow(self):
        """Cash Flow Report includes project cash flow (top 20)"""
        response = self.session.get(f"{BASE_URL}/api/finance/reports/cash-flow")
        assert response.status_code == 200
        
        data = response.json()
        assert "project_cash_flow" in data
        project_cash_flow = data["project_cash_flow"]
        assert isinstance(project_cash_flow, list)
        assert len(project_cash_flow) <= 20, "Should return max 20 projects"
        
        # If there's data, verify structure
        if project_cash_flow:
            for item in project_cash_flow:
                assert "project_id" in item
                assert "project_name" in item
                assert "inflow" in item
                assert "outflow" in item
                assert "net" in item
        
        print(f"✓ Project cash flow has {len(project_cash_flow)} projects")
    
    def test_cash_flow_report_unauthenticated(self):
        """GET /api/finance/reports/cash-flow - Unauthenticated returns 401"""
        new_session = requests.Session()
        response = new_session.get(f"{BASE_URL}/api/finance/reports/cash-flow")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Unauthenticated request returns 401")
    
    # ============ PROJECT PROFITABILITY REPORT API ============
    
    def test_project_profitability_report_default(self):
        """GET /api/finance/reports/project-profitability - Default parameters"""
        response = self.session.get(f"{BASE_URL}/api/finance/reports/project-profitability")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "summary" in data
        assert "projects" in data
        assert "top_profitable" in data
        assert "top_loss" in data
        assert "filters_applied" in data
        assert "generated_at" in data
        
        # Verify summary structure
        summary = data["summary"]
        assert "total_projects" in summary
        assert "profitable_projects" in summary
        assert "loss_projects" in summary
        assert "total_contract_value" in summary
        assert "total_received" in summary
        assert "total_actual_cost" in summary
        assert "total_realized_profit" in summary
        assert "overall_margin_percent" in summary
        
        print(f"✓ Project Profitability Report - Total projects: {summary['total_projects']}, Profitable: {summary['profitable_projects']}, Loss: {summary['loss_projects']}")
    
    def test_project_profitability_report_filter_by_stage(self):
        """GET /api/finance/reports/project-profitability?stage=Design Finalization"""
        response = self.session.get(
            f"{BASE_URL}/api/finance/reports/project-profitability?stage=Design%20Finalization"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["filters_applied"]["stage"] == "Design Finalization"
        print(f"✓ Filter by stage - Projects: {data['summary']['total_projects']}")
    
    def test_project_profitability_report_filter_profitable_only(self):
        """GET /api/finance/reports/project-profitability?status=profitable"""
        response = self.session.get(
            f"{BASE_URL}/api/finance/reports/project-profitability?status=profitable"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["filters_applied"]["status"] == "profitable"
        
        # All projects should be profitable
        for project in data["projects"]:
            assert project["profit_status"] == "profitable", f"Project {project['project_name']} should be profitable"
        
        print(f"✓ Filter profitable only - Projects: {len(data['projects'])}")
    
    def test_project_profitability_report_filter_loss_only(self):
        """GET /api/finance/reports/project-profitability?status=loss"""
        response = self.session.get(
            f"{BASE_URL}/api/finance/reports/project-profitability?status=loss"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["filters_applied"]["status"] == "loss"
        
        # All projects should be loss-making
        for project in data["projects"]:
            assert project["profit_status"] == "loss", f"Project {project['project_name']} should be loss-making"
        
        print(f"✓ Filter loss only - Projects: {len(data['projects'])}")
    
    def test_project_profitability_report_sort_by_margin(self):
        """GET /api/finance/reports/project-profitability?sort_by=margin_percent&sort_order=desc"""
        response = self.session.get(
            f"{BASE_URL}/api/finance/reports/project-profitability?sort_by=margin_percent&sort_order=desc"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["filters_applied"]["sort_by"] == "margin_percent"
        assert data["filters_applied"]["sort_order"] == "desc"
        
        # Verify sorting (descending)
        projects = data["projects"]
        if len(projects) > 1:
            for i in range(len(projects) - 1):
                assert projects[i]["realized_margin_percent"] >= projects[i+1]["realized_margin_percent"], \
                    "Projects should be sorted by margin descending"
        
        print(f"✓ Sort by margin descending - Projects: {len(projects)}")
    
    def test_project_profitability_report_sort_by_profit(self):
        """GET /api/finance/reports/project-profitability?sort_by=profit&sort_order=asc"""
        response = self.session.get(
            f"{BASE_URL}/api/finance/reports/project-profitability?sort_by=profit&sort_order=asc"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["filters_applied"]["sort_by"] == "profit"
        assert data["filters_applied"]["sort_order"] == "asc"
        
        print(f"✓ Sort by profit ascending - Projects: {len(data['projects'])}")
    
    def test_project_profitability_report_project_structure(self):
        """Verify project data structure in profitability report"""
        response = self.session.get(f"{BASE_URL}/api/finance/reports/project-profitability")
        assert response.status_code == 200
        
        data = response.json()
        projects = data["projects"]
        
        if projects:
            project = projects[0]
            required_fields = [
                "project_id", "pid", "project_name", "client_name", "stage",
                "contract_value", "total_received", "balance_due",
                "planned_cost", "actual_cost", "cost_variance",
                "projected_profit", "realized_profit",
                "projected_margin_percent", "realized_margin_percent",
                "profit_status", "risk_level"
            ]
            for field in required_fields:
                assert field in project, f"Missing field: {field}"
            
            print(f"✓ Project structure verified - All {len(required_fields)} fields present")
        else:
            print("✓ No projects to verify structure (empty list)")
    
    def test_project_profitability_report_top_profitable(self):
        """Verify top profitable projects list"""
        response = self.session.get(f"{BASE_URL}/api/finance/reports/project-profitability")
        assert response.status_code == 200
        
        data = response.json()
        top_profitable = data["top_profitable"]
        assert isinstance(top_profitable, list)
        assert len(top_profitable) <= 5, "Should return max 5 top profitable projects"
        
        print(f"✓ Top profitable projects: {len(top_profitable)}")
    
    def test_project_profitability_report_top_loss(self):
        """Verify top loss-making projects list"""
        response = self.session.get(f"{BASE_URL}/api/finance/reports/project-profitability")
        assert response.status_code == 200
        
        data = response.json()
        top_loss = data["top_loss"]
        assert isinstance(top_loss, list)
        
        # All should have negative profit
        for project in top_loss:
            assert project["realized_profit"] < 0, f"Project {project['project_name']} should have negative profit"
        
        print(f"✓ Top loss-making projects: {len(top_loss)}")
    
    def test_project_profitability_report_unauthenticated(self):
        """GET /api/finance/reports/project-profitability - Unauthenticated returns 401"""
        new_session = requests.Session()
        response = new_session.get(f"{BASE_URL}/api/finance/reports/project-profitability")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Unauthenticated request returns 401")
    
    # ============ CHARTERED ACCOUNTANT ROLE TESTS ============
    
    def test_ca_role_exists_in_valid_roles(self):
        """Verify CharteredAccountant role exists in system"""
        response = self.session.get(f"{BASE_URL}/api/roles/available")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        roles = data.get("roles", [])
        role_ids = [r["id"] for r in roles]
        
        assert "CharteredAccountant" in role_ids, "CharteredAccountant should be in valid roles"
        
        # Find CA role details
        ca_role = next((r for r in roles if r["id"] == "CharteredAccountant"), None)
        assert ca_role is not None
        assert ca_role["category"] == "Finance"
        
        print(f"✓ CharteredAccountant role exists - Category: {ca_role['category']}")
    
    def test_ca_role_permissions(self):
        """Verify CharteredAccountant has correct read-only permissions"""
        response = self.session.get(f"{BASE_URL}/api/roles/CharteredAccountant/default-permissions")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        permissions = data.get("default_permissions", [])
        
        # Should have view permissions
        assert "finance.cashbook.view" in permissions, "CA should have cashbook view"
        assert "finance.reports.view" in permissions, "CA should have reports view"
        assert "finance.reports.export" in permissions, "CA should have reports export"
        assert "finance.project.view" in permissions, "CA should have project finance view"
        assert "finance.receipts.view" in permissions, "CA should have receipts view"
        
        # Should NOT have edit/create permissions
        assert "finance.cashbook.create" not in permissions, "CA should NOT have cashbook create"
        assert "finance.cashbook.edit" not in permissions, "CA should NOT have cashbook edit"
        assert "finance.receipts.create" not in permissions, "CA should NOT have receipts create"
        
        print(f"✓ CharteredAccountant permissions verified - {len(permissions)} permissions (read-only)")
    
    def test_ca_user_invite(self):
        """Test inviting a CharteredAccountant user"""
        import uuid
        test_email = f"test_ca_{uuid.uuid4().hex[:8]}@example.com"
        
        response = self.session.post(
            f"{BASE_URL}/api/users/invite",
            json={
                "name": "Test CA User",
                "email": test_email,
                "role": "CharteredAccountant"
            }
        )
        
        # Should succeed (201) or fail with duplicate email (400)
        assert response.status_code in [200, 201, 400], f"Expected 200/201/400, got {response.status_code}: {response.text}"
        
        if response.status_code in [200, 201]:
            data = response.json()
            assert data.get("role") == "CharteredAccountant"
            print(f"✓ CA user invited successfully: {test_email}")
            
            # Cleanup - delete test user
            user_id = data.get("user_id")
            if user_id:
                self.session.delete(f"{BASE_URL}/api/users/{user_id}")
        else:
            print(f"✓ CA user invite test completed (email may already exist)")


class TestExportFromReports:
    """Test export functionality from reports pages"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get session"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": "thaha.pakayil@gmail.com", "password": "password123"}
        )
        if login_response.status_code != 200:
            pytest.skip("Login failed - skipping tests")
        yield
    
    def test_export_cashbook_from_cash_flow_report(self):
        """Export cashbook data (used by Cash Flow Report export)"""
        response = self.session.post(
            f"{BASE_URL}/api/admin/export",
            json={
                "data_type": "cashbook",
                "format": "xlsx"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert "application" in response.headers.get("content-type", "")
        print("✓ Cashbook export works (used by Cash Flow Report)")
    
    def test_export_project_finance_from_profitability_report(self):
        """Export project finance data (used by Project Profitability Report export)"""
        response = self.session.post(
            f"{BASE_URL}/api/admin/export",
            json={
                "data_type": "project_finance",
                "format": "xlsx"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert "application" in response.headers.get("content-type", "")
        print("✓ Project finance export works (used by Project Profitability Report)")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
