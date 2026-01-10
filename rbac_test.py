import requests
import sys
import json
from datetime import datetime, timezone, timedelta
import uuid
import subprocess

class RBACTester:
    def __init__(self, base_url="https://finance-tracker-1744.preview.emergentagent.com"):
        self.base_url = base_url
        self.tokens = {}  # Store tokens for each role
        self.user_ids = {}  # Store user IDs for each role
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        
        # All 9 roles to test
        self.roles = [
            "Admin", "Manager", "DesignManager", "ProductionManager", 
            "OperationsLead", "Designer", "HybridDesigner", "PreSales", "Trainee"
        ]

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, auth_token=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
            
        if auth_token:
            test_headers['Authorization'] = f'Bearer {auth_token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                except:
                    print(f"   Response: {response.text[:200]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:300]}...")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:300]
                })

            return success, response.json() if response.headers.get('content-type', '').startswith('application/json') else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "error": str(e)
            })
            return False, {}

    def setup_test_users_all_roles(self):
        """Create test users for all 9 roles"""
        print("\n🔧 Setting up test users for all 9 roles...")
        
        mongo_commands = "use('test_database');\n"
        
        for role in self.roles:
            user_id = f"test-{role.lower()}-{uuid.uuid4().hex[:8]}"
            session_token = f"test_{role.lower()}_session_{uuid.uuid4().hex[:16]}"
            
            self.user_ids[role] = user_id
            self.tokens[role] = session_token
            
            mongo_commands += f'''
// Create {role} user
db.users.insertOne({{
  user_id: "{user_id}",
  email: "{role.lower()}.test.{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com",
  name: "Test {role}",
  picture: "https://via.placeholder.com/150",
  role: "{role}",
  status: "Active",
  created_at: new Date()
}});

// Create {role} session
db.user_sessions.insertOne({{
  user_id: "{user_id}",
  session_token: "{session_token}",
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
}});

'''
        
        try:
            result = subprocess.run(['mongosh', '--eval', mongo_commands], 
                                  capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                print("✅ All test users and sessions created successfully")
                for role in self.roles:
                    print(f"   {role}: {self.user_ids[role]} -> {self.tokens[role]}")
                return True
            else:
                print(f"❌ Failed to create test users: {result.stderr}")
                return False
                
        except Exception as e:
            print(f"❌ Error setting up test users: {str(e)}")
            return False

    def test_user_invite_all_roles(self):
        """Test POST /api/users/invite - verify all roles can be assigned"""
        print("\n🧪 Testing User Invite for All 9 Roles...")
        
        all_passed = True
        
        for role in self.roles:
            invite_data = {
                "name": f"Invited {role}",
                "email": f"invited.{role.lower()}.{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com",
                "role": role,
                "phone": "+1234567890"
            }
            
            success, response = self.run_test(
                f"Invite User with {role} Role", 
                "POST", 
                "api/users/invite", 
                200,
                data=invite_data,
                auth_token=self.tokens["Admin"]
            )
            
            if success:
                # Verify the role was assigned correctly
                assigned_role = response.get("user", {}).get("role")
                if assigned_role == role:
                    print(f"   ✅ {role} role assigned correctly")
                else:
                    print(f"   ❌ {role} role assignment failed - got {assigned_role}")
                    all_passed = False
            else:
                all_passed = False
        
        return all_passed

    def test_role_specific_dashboard_access(self):
        """Test role-specific dashboard access"""
        print("\n🧪 Testing Role-Specific Dashboard Access...")
        
        # Test DesignManager dashboard
        print("\n--- Testing DesignManager Dashboard ---")
        
        # DesignManager, Admin, Manager should have access
        for role in ["DesignManager", "Admin", "Manager"]:
            success, _ = self.run_test(
                f"{role} Access to DesignManager Dashboard",
                "GET",
                "api/design-manager/dashboard",
                200,
                auth_token=self.tokens[role]
            )
            if not success:
                return False
        
        # Others should be denied
        for role in ["ProductionManager", "OperationsLead", "Designer", "HybridDesigner", "PreSales", "Trainee"]:
            success, _ = self.run_test(
                f"{role} Denied DesignManager Dashboard",
                "GET", 
                "api/design-manager/dashboard",
                403,
                auth_token=self.tokens[role]
            )
            if not success:
                return False
        
        # Test ProductionManager validation pipeline
        print("\n--- Testing ProductionManager Validation Pipeline ---")
        
        # ProductionManager, Admin, Manager should have access
        for role in ["ProductionManager", "Admin", "Manager"]:
            success, _ = self.run_test(
                f"{role} Access to Validation Pipeline",
                "GET",
                "api/validation-pipeline", 
                200,
                auth_token=self.tokens[role]
            )
            if not success:
                return False
        
        # Others should be denied
        for role in ["DesignManager", "OperationsLead", "Designer", "HybridDesigner", "PreSales", "Trainee"]:
            success, _ = self.run_test(
                f"{role} Denied Validation Pipeline",
                "GET",
                "api/validation-pipeline",
                403,
                auth_token=self.tokens[role]
            )
            if not success:
                return False
        
        # Test OperationsLead dashboard
        print("\n--- Testing OperationsLead Dashboard ---")
        
        # OperationsLead, Admin, Manager should have access
        for role in ["OperationsLead", "Admin", "Manager"]:
            success, _ = self.run_test(
                f"{role} Access to Operations Dashboard",
                "GET",
                "api/operations/dashboard",
                200,
                auth_token=self.tokens[role]
            )
            if not success:
                return False
        
        # Others should be denied
        for role in ["DesignManager", "ProductionManager", "Designer", "HybridDesigner", "PreSales", "Trainee"]:
            success, _ = self.run_test(
                f"{role} Denied Operations Dashboard",
                "GET",
                "api/operations/dashboard",
                403,
                auth_token=self.tokens[role]
            )
            if not success:
                return False
        
        # Test CEO dashboard (Admin only)
        print("\n--- Testing CEO Dashboard (Admin Only) ---")
        
        # Only Admin should have access
        success, _ = self.run_test(
            "Admin Access to CEO Dashboard",
            "GET",
            "api/ceo/dashboard",
            200,
            auth_token=self.tokens["Admin"]
        )
        if not success:
            return False
        
        # All others should be denied
        for role in ["Manager", "DesignManager", "ProductionManager", "OperationsLead", "Designer", "HybridDesigner", "PreSales", "Trainee"]:
            success, _ = self.run_test(
                f"{role} Denied CEO Dashboard",
                "GET",
                "api/ceo/dashboard",
                403,
                auth_token=self.tokens[role]
            )
            if not success:
                return False
        
        return True

    def test_auto_collaborator_system(self):
        """Test auto-collaborator system based on stage changes"""
        print("\n🧪 Testing Auto-Collaborator System...")
        
        # First seed projects to ensure we have test data
        success, seed_response = self.run_test(
            "Seed Projects for Auto-Collaborator Test",
            "POST",
            "api/projects/seed",
            200,
            auth_token=self.tokens["Admin"]
        )
        
        if not success:
            print("❌ Failed to seed projects")
            return False
        
        # Get list of projects
        success, projects_list = self.run_test(
            "Get Projects List for Auto-Collaborator",
            "GET",
            "api/projects",
            200,
            auth_token=self.tokens["Admin"]
        )
        
        if not success or not projects_list or len(projects_list) == 0:
            print("❌ No projects available for testing")
            return False
        
        project_id = projects_list[0]["project_id"]
        print(f"   Using project: {project_id}")
        
        # Test stage "Booked" should trigger DesignManager to be added
        print("\n--- Testing 'Booked' Stage Auto-Collaborator ---")
        
        success, stage_response = self.run_test(
            "Update Project to Booked Stage",
            "PUT",
            f"api/projects/{project_id}/stage",
            200,
            data={"stage": "Booked"},
            auth_token=self.tokens["Admin"]
        )
        
        if success:
            # Check if project activity feed has collaborator_added entries
            success, project_data = self.run_test(
                "Get Project Activity After Booked",
                "GET",
                f"api/projects/{project_id}",
                200,
                auth_token=self.tokens["Admin"]
            )
            
            if success:
                activity = project_data.get("activity", [])
                collaborator_added = any(
                    entry.get("type") == "collaborator_added" 
                    for entry in activity
                )
                print(f"   Collaborator added activity found: {collaborator_added}")
                
                # Check if DesignManager is in collaborators
                collaborators = project_data.get("collaborators", [])
                design_manager_added = any(
                    collab.get("role") == "DesignManager" 
                    for collab in collaborators
                )
                print(f"   DesignManager added as collaborator: {design_manager_added}")
        
        # Test stage "Validation & Kickoff" should trigger ProductionManager
        print("\n--- Testing 'Validation & Kickoff' Stage Auto-Collaborator ---")
        
        success, stage_response = self.run_test(
            "Update Project to Validation & Kickoff Stage",
            "PUT",
            f"api/projects/{project_id}/stage", 
            200,
            data={"stage": "Validation & Kickoff"},
            auth_token=self.tokens["Admin"]
        )
        
        if success:
            # Check project activity and collaborators
            success, project_data = self.run_test(
                "Get Project Activity After Validation",
                "GET",
                f"api/projects/{project_id}",
                200,
                auth_token=self.tokens["Admin"]
            )
            
            if success:
                collaborators = project_data.get("collaborators", [])
                production_manager_added = any(
                    collab.get("role") == "ProductionManager"
                    for collab in collaborators
                )
                print(f"   ProductionManager added as collaborator: {production_manager_added}")
        
        # Test stage "Delivery" should trigger OperationsLead
        print("\n--- Testing 'Delivery' Stage Auto-Collaborator ---")
        
        success, stage_response = self.run_test(
            "Update Project to Delivery Stage",
            "PUT",
            f"api/projects/{project_id}/stage",
            200,
            data={"stage": "Delivery"},
            auth_token=self.tokens["Admin"]
        )
        
        if success:
            # Check project activity and collaborators
            success, project_data = self.run_test(
                "Get Project Activity After Delivery",
                "GET",
                f"api/projects/{project_id}",
                200,
                auth_token=self.tokens["Admin"]
            )
            
            if success:
                collaborators = project_data.get("collaborators", [])
                operations_lead_added = any(
                    collab.get("role") == "OperationsLead"
                    for collab in collaborators
                )
                print(f"   OperationsLead added as collaborator: {operations_lead_added}")
                
                # Check activity feed for all collaborator additions
                activity = project_data.get("activity", [])
                collaborator_activities = [
                    entry for entry in activity 
                    if entry.get("type") == "collaborator_added"
                ]
                print(f"   Total collaborator_added activities: {len(collaborator_activities)}")
                
                return len(collaborator_activities) > 0
        
        return False

    def test_role_restrictions(self):
        """Test role restrictions - users should NOT access certain endpoints"""
        print("\n🧪 Testing Role Restrictions...")
        
        # DesignManager should NOT access CEO dashboard
        success, _ = self.run_test(
            "DesignManager Denied CEO Dashboard",
            "GET",
            "api/ceo/dashboard",
            403,
            auth_token=self.tokens["DesignManager"]
        )
        if not success:
            return False
        
        # ProductionManager should NOT access DesignManager dashboard
        success, _ = self.run_test(
            "ProductionManager Denied DesignManager Dashboard",
            "GET",
            "api/design-manager/dashboard",
            403,
            auth_token=self.tokens["ProductionManager"]
        )
        if not success:
            return False
        
        # OperationsLead should NOT access validation pipeline
        success, _ = self.run_test(
            "OperationsLead Denied Validation Pipeline",
            "GET",
            "api/validation-pipeline",
            403,
            auth_token=self.tokens["OperationsLead"]
        )
        if not success:
            return False
        
        # Designer should NOT access any manager dashboards
        manager_endpoints = [
            "api/ceo/dashboard",
            "api/design-manager/dashboard", 
            "api/validation-pipeline",
            "api/operations/dashboard"
        ]
        
        for endpoint in manager_endpoints:
            success, _ = self.run_test(
                f"Designer Denied {endpoint}",
                "GET",
                endpoint,
                403,
                auth_token=self.tokens["Designer"]
            )
            if not success:
                return False
        
        return True

    def test_activity_feed(self):
        """Test activity feed for stage changes and collaborator additions"""
        print("\n🧪 Testing Activity Feed...")
        
        # First seed projects to ensure we have test data
        success, seed_response = self.run_test(
            "Seed Projects for Activity Feed Test",
            "POST",
            "api/projects/seed",
            200,
            auth_token=self.tokens["Admin"]
        )
        
        if not success:
            print("❌ Failed to seed projects")
            return False
        
        # Get list of projects
        success, projects_list = self.run_test(
            "Get Projects List for Activity Feed",
            "GET",
            "api/projects",
            200,
            auth_token=self.tokens["Admin"]
        )
        
        if not success or not projects_list or len(projects_list) == 0:
            print("❌ No projects available for testing")
            return False
        
        project_id = projects_list[0]["project_id"]
        
        # Update stage to generate activity
        success, _ = self.run_test(
            "Update Stage to Generate Activity",
            "PUT",
            f"api/projects/{project_id}/stage",
            200,
            data={"stage": "Production Preparation"},
            auth_token=self.tokens["Admin"]
        )
        
        if not success:
            return False
        
        # Get project and check activity array
        success, project_data = self.run_test(
            "Get Project with Activity Feed",
            "GET",
            f"api/projects/{project_id}",
            200,
            auth_token=self.tokens["Admin"]
        )
        
        if success:
            # Check if activity array exists
            has_activity = "activity" in project_data
            activity = project_data.get("activity", [])
            
            print(f"   Activity array present: {has_activity}")
            print(f"   Activity entries count: {len(activity)}")
            
            if len(activity) > 0:
                # Check for stage change entries
                stage_changes = [
                    entry for entry in activity 
                    if entry.get("type") == "stage_change"
                ]
                
                # Check for collaborator addition entries
                collaborator_additions = [
                    entry for entry in activity
                    if entry.get("type") == "collaborator_added"
                ]
                
                print(f"   Stage change entries: {len(stage_changes)}")
                print(f"   Collaborator addition entries: {len(collaborator_additions)}")
                
                # Verify activity entry structure
                if len(activity) > 0:
                    first_entry = activity[0]
                    has_required_fields = all(
                        field in first_entry 
                        for field in ["id", "type", "message", "user_id", "user_name", "timestamp"]
                    )
                    print(f"   Activity entry structure valid: {has_required_fields}")
                    
                    return has_activity and has_required_fields
            
            return has_activity
        
        return False

    def run_all_tests(self):
        """Run all RBAC tests"""
        print("🚀 Starting Livspace-style RBAC Testing for Arkiflo...")
        print("=" * 60)
        
        # Setup test users
        if not self.setup_test_users_all_roles():
            print("❌ Failed to setup test users")
            return False
        
        # Test 1: User invite for all roles
        print("\n" + "=" * 60)
        print("TEST 1: User Invite for All 9 Roles")
        print("=" * 60)
        if not self.test_user_invite_all_roles():
            print("❌ User invite test failed")
        
        # Test 2: Role-specific dashboard access
        print("\n" + "=" * 60)
        print("TEST 2: Role-Specific Dashboard Access")
        print("=" * 60)
        if not self.test_role_specific_dashboard_access():
            print("❌ Dashboard access test failed")
        
        # Test 3: Auto-collaborator system
        print("\n" + "=" * 60)
        print("TEST 3: Auto-Collaborator System")
        print("=" * 60)
        if not self.test_auto_collaborator_system():
            print("❌ Auto-collaborator test failed")
        
        # Test 4: Role restrictions
        print("\n" + "=" * 60)
        print("TEST 4: Role Restrictions")
        print("=" * 60)
        if not self.test_role_restrictions():
            print("❌ Role restrictions test failed")
        
        # Test 5: Activity feed
        print("\n" + "=" * 60)
        print("TEST 5: Activity Feed")
        print("=" * 60)
        if not self.test_activity_feed():
            print("❌ Activity feed test failed")
        
        # Print summary
        print("\n" + "=" * 60)
        print("RBAC TEST SUMMARY")
        print("=" * 60)
        print(f"Total tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Tests failed: {self.tests_run - self.tests_passed}")
        print(f"Success rate: {(self.tests_passed / self.tests_run * 100):.1f}%")
        
        if self.failed_tests:
            print("\n❌ Failed tests:")
            for test in self.failed_tests:
                print(f"   - {test['test']}")
                if 'error' in test:
                    print(f"     Error: {test['error']}")
                else:
                    print(f"     Expected: {test['expected']}, Got: {test['actual']}")
        
        return self.tests_passed == self.tests_run

if __name__ == "__main__":
    tester = RBACTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)