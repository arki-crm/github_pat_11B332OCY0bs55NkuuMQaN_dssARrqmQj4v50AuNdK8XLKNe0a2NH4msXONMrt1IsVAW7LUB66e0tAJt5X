"""
Test Finance Controls Phase 3 APIs:
- Founder Dashboard
- Daily Closing
- Monthly Snapshot
- Project Surplus Status
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestFinanceControlsAuth:
    """Test authentication and login"""
    
    @pytest.fixture(scope="class")
    def session(self):
        return requests.Session()
    
    @pytest.fixture(scope="class")
    def auth_session(self, session):
        """Login and return authenticated session"""
        login_response = session.post(f"{BASE_URL}/api/auth/local-login", json={
            "email": "thaha.pakayil@gmail.com",
            "password": "password123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        return session


class TestFounderDashboard:
    """Test Founder Dashboard API - GET /api/finance/founder-dashboard"""
    
    @pytest.fixture(scope="class")
    def session(self):
        s = requests.Session()
        login_response = s.post(f"{BASE_URL}/api/auth/local-login", json={
            "email": "thaha.pakayil@gmail.com",
            "password": "password123"
        })
        assert login_response.status_code == 200
        return s
    
    def test_founder_dashboard_returns_health_status(self, session):
        """GET /api/finance/founder-dashboard returns health, cash, locked, surplus"""
        response = session.get(f"{BASE_URL}/api/finance/founder-dashboard")
        assert response.status_code == 200
        
        data = response.json()
        # Verify required fields
        assert "health" in data
        assert data["health"] in ["healthy", "warning", "critical"]
        assert "health_message" in data
        assert "total_cash_available" in data
        assert "total_locked_commitments" in data
        assert "safe_surplus" in data
        
    def test_founder_dashboard_has_account_balances(self, session):
        """Founder dashboard includes account balances breakdown"""
        response = session.get(f"{BASE_URL}/api/finance/founder-dashboard")
        assert response.status_code == 200
        
        data = response.json()
        assert "account_balances" in data
        assert isinstance(data["account_balances"], list)
        
        # Verify account balance structure
        if len(data["account_balances"]) > 0:
            acc = data["account_balances"][0]
            assert "account_name" in acc
            assert "balance" in acc
    
    def test_founder_dashboard_has_month_to_date(self, session):
        """Founder dashboard includes month-to-date summary"""
        response = session.get(f"{BASE_URL}/api/finance/founder-dashboard")
        assert response.status_code == 200
        
        data = response.json()
        assert "month_to_date" in data
        mtd = data["month_to_date"]
        assert "month" in mtd
        assert "received" in mtd
        assert "spent" in mtd
        assert "net" in mtd
    
    def test_founder_dashboard_has_risky_projects(self, session):
        """Founder dashboard includes risky projects list"""
        response = session.get(f"{BASE_URL}/api/finance/founder-dashboard")
        assert response.status_code == 200
        
        data = response.json()
        assert "risky_projects" in data
        assert "risky_project_count" in data
        assert isinstance(data["risky_projects"], list)


class TestDailyClosing:
    """Test Daily Closing APIs"""
    
    @pytest.fixture(scope="class")
    def session(self):
        s = requests.Session()
        login_response = s.post(f"{BASE_URL}/api/auth/local-login", json={
            "email": "thaha.pakayil@gmail.com",
            "password": "password123"
        })
        assert login_response.status_code == 200
        return s
    
    def test_daily_closing_returns_account_breakdown(self, session):
        """GET /api/finance/daily-closing?date=YYYY-MM-DD returns account-wise breakdown"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = session.get(f"{BASE_URL}/api/finance/daily-closing", params={"date": today})
        assert response.status_code == 200
        
        data = response.json()
        assert "date" in data
        assert data["date"] == today
        assert "accounts" in data
        assert "totals" in data
        assert "is_closed" in data
        
    def test_daily_closing_account_structure(self, session):
        """Daily closing accounts have correct structure"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = session.get(f"{BASE_URL}/api/finance/daily-closing", params={"date": today})
        assert response.status_code == 200
        
        data = response.json()
        if len(data["accounts"]) > 0:
            acc = data["accounts"][0]
            assert "account_id" in acc
            assert "account_name" in acc
            assert "opening_balance" in acc
            assert "inflow" in acc
            assert "outflow" in acc
            assert "closing_balance" in acc
            assert "transaction_count" in acc
    
    def test_daily_closing_totals_structure(self, session):
        """Daily closing totals have correct structure"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = session.get(f"{BASE_URL}/api/finance/daily-closing", params={"date": today})
        assert response.status_code == 200
        
        data = response.json()
        totals = data["totals"]
        assert "opening" in totals
        assert "inflow" in totals
        assert "outflow" in totals
        assert "closing" in totals
    
    def test_daily_closing_history_returns_list(self, session):
        """GET /api/finance/daily-closing/history returns recent closings"""
        response = session.get(f"{BASE_URL}/api/finance/daily-closing/history", params={"limit": 10})
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # If there are closings, verify structure
        if len(data) > 0:
            closing = data[0]
            assert "date" in closing
            assert "is_closed" in closing
    
    def test_daily_closing_past_date(self, session):
        """Daily closing works for past dates"""
        past_date = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
        response = session.get(f"{BASE_URL}/api/finance/daily-closing", params={"date": past_date})
        assert response.status_code == 200
        
        data = response.json()
        assert data["date"] == past_date


class TestDailyClosingClose:
    """Test closing a day - POST /api/finance/daily-closing/{date}/close"""
    
    @pytest.fixture(scope="class")
    def session(self):
        s = requests.Session()
        login_response = s.post(f"{BASE_URL}/api/auth/local-login", json={
            "email": "thaha.pakayil@gmail.com",
            "password": "password123"
        })
        assert login_response.status_code == 200
        return s
    
    def test_close_day_locks_transactions(self, session):
        """POST /api/finance/daily-closing/{date}/close locks the day"""
        # Use a date far in the past that's unlikely to be closed
        test_date = "2024-01-15"
        
        # First check if already closed
        check_response = session.get(f"{BASE_URL}/api/finance/daily-closing", params={"date": test_date})
        if check_response.status_code == 200:
            check_data = check_response.json()
            if check_data.get("is_closed"):
                # Already closed, verify it returns error on re-close
                response = session.post(f"{BASE_URL}/api/finance/daily-closing/{test_date}/close")
                assert response.status_code == 400
                return
        
        # Try to close the day
        response = session.post(f"{BASE_URL}/api/finance/daily-closing/{test_date}/close")
        # Should succeed or fail with 400 if already closed
        assert response.status_code in [200, 400]
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            assert "closing" in data


class TestMonthlySnapshots:
    """Test Monthly Snapshot APIs"""
    
    @pytest.fixture(scope="class")
    def session(self):
        s = requests.Session()
        login_response = s.post(f"{BASE_URL}/api/auth/local-login", json={
            "email": "thaha.pakayil@gmail.com",
            "password": "password123"
        })
        assert login_response.status_code == 200
        return s
    
    def test_monthly_snapshots_list(self, session):
        """GET /api/finance/monthly-snapshots returns list of snapshots"""
        response = session.get(f"{BASE_URL}/api/finance/monthly-snapshots")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
    
    def test_monthly_snapshots_filter_by_year(self, session):
        """GET /api/finance/monthly-snapshots?year=YYYY filters by year"""
        current_year = datetime.now().year
        response = session.get(f"{BASE_URL}/api/finance/monthly-snapshots", params={"year": current_year})
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
    
    def test_monthly_snapshot_detail(self, session):
        """GET /api/finance/monthly-snapshots/{year}/{month} returns snapshot data"""
        current_year = datetime.now().year
        current_month = datetime.now().month
        
        response = session.get(f"{BASE_URL}/api/finance/monthly-snapshots/{current_year}/{current_month}")
        assert response.status_code == 200
        
        data = response.json()
        assert "year" in data
        assert "month" in data
        assert "total_inflow" in data
        assert "total_outflow" in data
        assert "net_change" in data
        assert "cash_position" in data
        assert "is_closed" in data
    
    def test_monthly_snapshot_has_planned_vs_actual(self, session):
        """Monthly snapshot includes planned vs actual comparison"""
        current_year = datetime.now().year
        current_month = datetime.now().month
        
        response = session.get(f"{BASE_URL}/api/finance/monthly-snapshots/{current_year}/{current_month}")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_planned_cost" in data
        assert "total_actual_cost" in data
        assert "planned_vs_actual_diff" in data
    
    def test_monthly_snapshot_past_month(self, session):
        """Monthly snapshot works for past months"""
        # Get last month
        now = datetime.now()
        if now.month == 1:
            year = now.year - 1
            month = 12
        else:
            year = now.year
            month = now.month - 1
        
        response = session.get(f"{BASE_URL}/api/finance/monthly-snapshots/{year}/{month}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["year"] == year
        assert data["month"] == month


class TestMonthlySnapshotClose:
    """Test closing a month - POST /api/finance/monthly-snapshots/{year}/{month}/close"""
    
    @pytest.fixture(scope="class")
    def session(self):
        s = requests.Session()
        login_response = s.post(f"{BASE_URL}/api/auth/local-login", json={
            "email": "thaha.pakayil@gmail.com",
            "password": "password123"
        })
        assert login_response.status_code == 200
        return s
    
    def test_cannot_close_current_month(self, session):
        """Cannot close current or future months"""
        current_year = datetime.now().year
        current_month = datetime.now().month
        
        response = session.post(f"{BASE_URL}/api/finance/monthly-snapshots/{current_year}/{current_month}/close")
        assert response.status_code == 400
        assert "Cannot close current or future months" in response.json().get("detail", "")
    
    def test_cannot_close_future_month(self, session):
        """Cannot close future months"""
        future_year = datetime.now().year + 1
        
        response = session.post(f"{BASE_URL}/api/finance/monthly-snapshots/{future_year}/1/close")
        assert response.status_code == 400


class TestProjectSurplusStatus:
    """Test Project Surplus Status API - GET /api/finance/project-surplus-status"""
    
    @pytest.fixture(scope="class")
    def session(self):
        s = requests.Session()
        login_response = s.post(f"{BASE_URL}/api/auth/local-login", json={
            "email": "thaha.pakayil@gmail.com",
            "password": "password123"
        })
        assert login_response.status_code == 200
        return s
    
    def test_project_surplus_status_returns_risk_levels(self, session):
        """GET /api/finance/project-surplus-status returns risk levels"""
        response = session.get(f"{BASE_URL}/api/finance/project-surplus-status")
        assert response.status_code == 200
        
        data = response.json()
        assert "projects" in data
        assert "green" in data["projects"]
        assert "amber" in data["projects"]
        assert "red" in data["projects"]
        assert "summary" in data
    
    def test_project_surplus_status_summary(self, session):
        """Project surplus status includes summary counts"""
        response = session.get(f"{BASE_URL}/api/finance/project-surplus-status")
        assert response.status_code == 200
        
        data = response.json()
        summary = data["summary"]
        assert "total" in summary
        assert "green" in summary
        assert "amber" in summary
        assert "red" in summary
    
    def test_project_surplus_status_project_structure(self, session):
        """Project surplus status projects have correct structure"""
        response = session.get(f"{BASE_URL}/api/finance/project-surplus-status")
        assert response.status_code == 200
        
        data = response.json()
        projects = data["projects"]
        # Check any non-empty category
        for category in ["green", "amber", "red"]:
            if len(projects[category]) > 0:
                project = projects[category][0]
                assert "project_id" in project
                assert "project_name" in project
                assert "safe_surplus" in project
                assert "risk_level" in project
                assert project["risk_level"] == category
                break


class TestFinanceControlsDataIntegrity:
    """Test data integrity and calculations"""
    
    @pytest.fixture(scope="class")
    def session(self):
        s = requests.Session()
        login_response = s.post(f"{BASE_URL}/api/auth/local-login", json={
            "email": "thaha.pakayil@gmail.com",
            "password": "password123"
        })
        assert login_response.status_code == 200
        return s
    
    def test_founder_dashboard_surplus_calculation(self, session):
        """Safe surplus = total cash - locked commitments"""
        response = session.get(f"{BASE_URL}/api/finance/founder-dashboard")
        assert response.status_code == 200
        
        data = response.json()
        expected_surplus = data["total_cash_available"] - data["total_locked_commitments"]
        assert data["safe_surplus"] == expected_surplus
    
    def test_daily_closing_balance_calculation(self, session):
        """Closing balance = opening + inflow - outflow"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = session.get(f"{BASE_URL}/api/finance/daily-closing", params={"date": today})
        assert response.status_code == 200
        
        data = response.json()
        totals = data["totals"]
        expected_closing = totals["opening"] + totals["inflow"] - totals["outflow"]
        assert totals["closing"] == expected_closing
    
    def test_monthly_snapshot_net_change_calculation(self, session):
        """Net change = inflow - outflow"""
        current_year = datetime.now().year
        current_month = datetime.now().month
        
        response = session.get(f"{BASE_URL}/api/finance/monthly-snapshots/{current_year}/{current_month}")
        assert response.status_code == 200
        
        data = response.json()
        expected_net = data["total_inflow"] - data["total_outflow"]
        assert data["net_change"] == expected_net


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
