#!/usr/bin/env python3
"""
Calendar System Testing Script for Arkiflo
Tests Task CRUD API and Calendar Events API
"""

import requests
import json
import uuid
from datetime import datetime, timezone, timedelta

class CalendarSystemTester:
    def __init__(self, base_url="https://crm-repair-4.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.designer_token = None
        self.admin_user_id = None
        self.designer_user_id = None
        self.test_project_id = None
        self.test_task_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, auth_token=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if auth_token:
            headers['Authorization'] = f'Bearer {auth_token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

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

    def setup_test_users(self):
        """Create test users and sessions directly in MongoDB"""
        print("\n🔧 Setting up test users and sessions...")
        
        # Create admin user
        admin_user_id = f"test-admin-{uuid.uuid4().hex[:8]}"
        admin_session_token = f"test_admin_session_{uuid.uuid4().hex[:16]}"
        
        # Create designer user  
        designer_user_id = f"test-designer-{uuid.uuid4().hex[:8]}"
        designer_session_token = f"test_designer_session_{uuid.uuid4().hex[:16]}"
        
        # MongoDB commands to create test data
        mongo_commands = f'''
use('test_database');

// Create admin user
db.users.insertOne({{
  user_id: "{admin_user_id}",
  email: "admin.test.{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com",
  name: "Test Admin",
  picture: "https://via.placeholder.com/150",
  role: "Admin",
  status: "Active",
  created_at: new Date()
}});

// Create designer user
db.users.insertOne({{
  user_id: "{designer_user_id}",
  email: "designer.test.{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com",
  name: "Test Designer", 
  picture: "https://via.placeholder.com/150",
  role: "Designer",
  status: "Active",
  created_at: new Date()
}});

// Create admin session
db.user_sessions.insertOne({{
  user_id: "{admin_user_id}",
  session_token: "{admin_session_token}",
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
}});

// Create designer session
db.user_sessions.insertOne({{
  user_id: "{designer_user_id}",
  session_token: "{designer_session_token}",
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
}});

print("Admin session token: {admin_session_token}");
print("Designer session token: {designer_session_token}");
print("Admin user ID: {admin_user_id}");
print("Designer user ID: {designer_user_id}");
'''
        
        try:
            import subprocess
            result = subprocess.run(['mongosh', '--eval', mongo_commands], 
                                  capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                print("✅ Test users and sessions created successfully")
                self.admin_token = admin_session_token
                self.designer_token = designer_session_token
                self.admin_user_id = admin_user_id
                self.designer_user_id = designer_user_id
                return True
            else:
                print(f"❌ Failed to create test users: {result.stderr}")
                return False
                
        except Exception as e:
            print(f"❌ Error setting up test users: {str(e)}")
            return False

    def seed_projects(self):
        """Seed sample projects to get milestones"""
        print("\n📁 Seeding projects for milestones...")
        success, response = self.run_test("Seed Projects", "POST", "api/projects/seed", 200,
                                         auth_token=self.admin_token)
        if success:
            # Get first project ID for testing
            success2, projects = self.run_test("Get Projects", "GET", "api/projects", 200,
                                             auth_token=self.admin_token)
            if success2 and projects and len(projects) > 0:
                self.test_project_id = projects[0]['project_id']
                print(f"   Using project ID: {self.test_project_id}")
        return success

    # ============ TASK SYSTEM TESTS ============
    
    def test_create_task(self):
        """Test POST /api/tasks - Create task"""
        task_data = {
            "title": "Test Calendar Task",
            "description": "This is a test task for the calendar system",
            "project_id": self.test_project_id,
            "assigned_to": self.designer_user_id,
            "priority": "High",
            "due_date": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        }
        
        success, task_response = self.run_test("Create Task", "POST", "api/tasks", 200,
                                              data=task_data, auth_token=self.admin_token)
        if success:
            # Verify task structure
            has_id = 'id' in task_response
            has_title = task_response.get('title') == task_data['title']
            has_assignee = task_response.get('assigned_to') == task_data['assigned_to']
            has_priority = task_response.get('priority') == task_data['priority']
            has_status = task_response.get('status') == 'Pending'
            
            print(f"   ✓ Task ID present: {has_id}")
            print(f"   ✓ Title correct: {has_title}")
            print(f"   ✓ Assignee correct: {has_assignee}")
            print(f"   ✓ Priority correct: {has_priority}")
            print(f"   ✓ Default status: {has_status}")
            
            if has_id:
                self.test_task_id = task_response['id']
            
            return success and has_id and has_title and has_assignee and has_priority and has_status
        return success

    def test_create_standalone_task(self):
        """Test POST /api/tasks - Create standalone task (no project)"""
        task_data = {
            "title": "Standalone Calendar Task",
            "description": "This is a standalone task not linked to any project",
            "assigned_to": self.designer_user_id,
            "priority": "Medium",
            "due_date": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
        }
        
        success, task_response = self.run_test("Create Standalone Task", "POST", "api/tasks", 200,
                                              data=task_data, auth_token=self.admin_token)
        if success:
            has_no_project = task_response.get('project_id') is None
            has_title = task_response.get('title') == task_data['title']
            
            print(f"   ✓ No project ID (standalone): {has_no_project}")
            print(f"   ✓ Title correct: {has_title}")
            
            return success and has_no_project and has_title
        return success

    def test_list_tasks(self):
        """Test GET /api/tasks - List tasks with filters"""
        # Test basic list
        success1, tasks_data = self.run_test("List Tasks", "GET", "api/tasks", 200,
                                            auth_token=self.admin_token)
        
        # Test with filters
        success2, _ = self.run_test("List Tasks (Project Filter)", "GET", 
                                   f"api/tasks?project_id={self.test_project_id}", 200,
                                   auth_token=self.admin_token)
        
        success3, _ = self.run_test("List Tasks (Status Filter)", "GET", 
                                   "api/tasks?status=Pending", 200,
                                   auth_token=self.admin_token)
        
        success4, _ = self.run_test("List Tasks (Priority Filter)", "GET", 
                                   "api/tasks?priority=High", 200,
                                   auth_token=self.admin_token)
        
        success5, _ = self.run_test("List Tasks (Standalone Filter)", "GET", 
                                   "api/tasks?standalone=true", 200,
                                   auth_token=self.admin_token)
        
        if success1:
            is_array = isinstance(tasks_data, list)
            print(f"   ✓ Tasks is array: {is_array}")
            print(f"   ✓ Tasks count: {len(tasks_data) if is_array else 'N/A'}")
            
            if is_array and len(tasks_data) > 0:
                first_task = tasks_data[0]
                has_required_fields = all(field in first_task for field in 
                                        ['id', 'title', 'assigned_to', 'priority', 'status', 'due_date'])
                print(f"   ✓ Required fields present: {has_required_fields}")
        
        return success1 and success2 and success3 and success4 and success5

    def test_task_role_permissions(self):
        """Test task role-based permissions"""
        # Designer sees only their tasks
        success1, designer_tasks = self.run_test("List Tasks (Designer)", "GET", "api/tasks", 200,
                                                auth_token=self.designer_token)
        
        # Designer can only create tasks for themselves
        task_data = {
            "title": "Designer Self Task",
            "assigned_to": self.designer_user_id,
            "priority": "Low",
            "due_date": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        }
        
        success2, _ = self.run_test("Designer Create Self Task", "POST", "api/tasks", 200,
                                   data=task_data, auth_token=self.designer_token)
        
        # Designer cannot create tasks for others
        task_data_other = {
            "title": "Designer Other Task",
            "assigned_to": self.admin_user_id,
            "priority": "Low",
            "due_date": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        }
        
        success3, _ = self.run_test("Designer Create Other Task (Should Fail)", "POST", "api/tasks", 403,
                                   data=task_data_other, auth_token=self.designer_token)
        
        if success1:
            # Check that all tasks are assigned to this designer
            all_assigned_to_designer = True
            if isinstance(designer_tasks, list):
                for task in designer_tasks:
                    if task.get('assigned_to') != self.designer_user_id:
                        all_assigned_to_designer = False
                        break
            print(f"   ✓ All designer tasks assigned to designer: {all_assigned_to_designer}")
        
        return success1 and success2 and success3

    def test_update_task(self):
        """Test PUT /api/tasks/{task_id} - Update task"""
        if not self.test_task_id:
            print("   ⚠️ No test task available for update test")
            return True
        
        update_data = {
            "status": "In Progress",
            "title": "Updated Calendar Task"
        }
        
        success, task_data = self.run_test("Update Task", "PUT", 
                                          f"api/tasks/{self.test_task_id}", 200,
                                          data=update_data, auth_token=self.admin_token)
        if success:
            status_updated = task_data.get('status') == update_data['status']
            title_updated = task_data.get('title') == update_data['title']
            
            print(f"   ✓ Status updated: {status_updated}")
            print(f"   ✓ Title updated: {title_updated}")
            
            return success and status_updated and title_updated
        return success

    def test_task_validation(self):
        """Test task validation"""
        # Test invalid priority
        task_data = {
            "title": "Invalid Priority Task",
            "assigned_to": self.designer_user_id,
            "priority": "Invalid",
            "due_date": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        }
        
        success1, _ = self.run_test("Create Task (Invalid Priority)", "POST", "api/tasks", 400,
                                   data=task_data, auth_token=self.admin_token)
        
        # Test invalid status update
        if self.test_task_id:
            update_data = {"status": "Invalid Status"}
            success2, _ = self.run_test("Update Task (Invalid Status)", "PUT", 
                                       f"api/tasks/{self.test_task_id}", 400,
                                       data=update_data, auth_token=self.admin_token)
        else:
            success2 = True
        
        return success1 and success2

    # ============ CALENDAR EVENTS TESTS ============
    
    def test_calendar_events_basic(self):
        """Test GET /api/calendar-events - Basic calendar events"""
        success, events_data = self.run_test("Get Calendar Events", "GET", "api/calendar-events", 200,
                                            auth_token=self.admin_token)
        if success:
            # Verify response structure
            has_events = 'events' in events_data
            has_total = 'total' in events_data
            events_is_array = isinstance(events_data.get('events', []), list)
            
            print(f"   ✓ Has events array: {has_events}")
            print(f"   ✓ Has total count: {has_total}")
            print(f"   ✓ Events is array: {events_is_array}")
            print(f"   ✓ Events count: {len(events_data.get('events', []))}")
            
            # Check event structure if events exist
            if events_is_array and len(events_data.get('events', [])) > 0:
                first_event = events_data['events'][0]
                required_fields = ['id', 'title', 'start', 'end', 'type', 'status', 'color']
                has_required_fields = all(field in first_event for field in required_fields)
                
                valid_type = first_event.get('type') in ['milestone', 'task']
                has_color = 'color' in first_event and first_event['color'].startswith('#')
                
                print(f"   ✓ Required fields present: {has_required_fields}")
                print(f"   ✓ Valid event type: {valid_type}")
                print(f"   ✓ Has color coding: {has_color}")
                
                return success and has_events and has_total and events_is_array and has_required_fields and valid_type and has_color
            
            return success and has_events and has_total and events_is_array
        return success

    def test_calendar_events_filters(self):
        """Test GET /api/calendar-events with filters"""
        # Test date range filter
        start_date = datetime.now(timezone.utc).isoformat()
        end_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        
        success1, _ = self.run_test("Calendar Events (Date Range)", "GET", 
                                   f"api/calendar-events?start_date={start_date}&end_date={end_date}", 200,
                                   auth_token=self.admin_token)
        
        # Test event type filters
        success2, milestone_events = self.run_test("Calendar Events (Milestones Only)", "GET", 
                                                  "api/calendar-events?event_type=milestone", 200,
                                                  auth_token=self.admin_token)
        
        success3, task_events = self.run_test("Calendar Events (Tasks Only)", "GET", 
                                             "api/calendar-events?event_type=task", 200,
                                             auth_token=self.admin_token)
        
        # Test status filter
        success4, _ = self.run_test("Calendar Events (Status Filter)", "GET", 
                                   "api/calendar-events?status=pending", 200,
                                   auth_token=self.admin_token)
        
        # Verify filtering works
        milestone_filter_works = True
        task_filter_works = True
        
        if success2 and 'events' in milestone_events:
            for event in milestone_events['events']:
                if event.get('type') != 'milestone':
                    milestone_filter_works = False
                    break
        
        if success3 and 'events' in task_events:
            for event in task_events['events']:
                if event.get('type') != 'task':
                    task_filter_works = False
                    break
        
        print(f"   ✓ Milestone filter works: {milestone_filter_works}")
        print(f"   ✓ Task filter works: {task_filter_works}")
        
        return success1 and success2 and success3 and success4 and milestone_filter_works and task_filter_works

    def test_calendar_events_color_coding(self):
        """Test calendar events color coding"""
        success, events_data = self.run_test("Calendar Events for Color Test", "GET", "api/calendar-events", 200,
                                            auth_token=self.admin_token)
        if success and 'events' in events_data:
            events = events_data['events']
            color_coding_correct = True
            color_issues = []
            
            for event in events:
                event_type = event.get('type')
                status = event.get('status')
                color = event.get('color')
                
                if event_type == 'milestone':
                    # Milestone colors: Blue (#2563EB) upcoming, Green (#22C55E) completed, Red (#EF4444) delayed
                    if status == 'completed' and color != '#22C55E':
                        color_coding_correct = False
                        color_issues.append(f"Milestone completed color wrong: {color} (expected #22C55E)")
                    elif status == 'delayed' and color != '#EF4444':
                        color_coding_correct = False
                        color_issues.append(f"Milestone delayed color wrong: {color} (expected #EF4444)")
                    elif status == 'pending' and color != '#2563EB':
                        color_coding_correct = False
                        color_issues.append(f"Milestone pending color wrong: {color} (expected #2563EB)")
                
                elif event_type == 'task':
                    # Task colors: Yellow (#EAB308) pending, Orange (#F97316) in-progress, Green completed, Red overdue
                    if status == 'completed' and color != '#22C55E':
                        color_coding_correct = False
                        color_issues.append(f"Task completed color wrong: {color} (expected #22C55E)")
                    elif status == 'overdue' and color != '#EF4444':
                        color_coding_correct = False
                        color_issues.append(f"Task overdue color wrong: {color} (expected #EF4444)")
                    elif status == 'in progress' and color != '#F97316':
                        color_coding_correct = False
                        color_issues.append(f"Task in-progress color wrong: {color} (expected #F97316)")
                    elif status == 'pending' and color != '#EAB308':
                        color_coding_correct = False
                        color_issues.append(f"Task pending color wrong: {color} (expected #EAB308)")
            
            print(f"   ✓ Color coding correct: {color_coding_correct}")
            print(f"   ✓ Events checked: {len(events)}")
            
            if color_issues:
                for issue in color_issues[:3]:  # Show first 3 issues
                    print(f"   ❌ {issue}")
            
            return success and color_coding_correct
        
        return success

    def test_calendar_events_role_access(self):
        """Test calendar events role-based filtering"""
        # Admin sees all events
        success1, admin_events = self.run_test("Calendar Events (Admin)", "GET", "api/calendar-events", 200,
                                              auth_token=self.admin_token)
        
        # Designer sees only their assigned tasks and project milestones
        success2, designer_events = self.run_test("Calendar Events (Designer)", "GET", "api/calendar-events", 200,
                                                 auth_token=self.designer_token)
        
        # Verify role-based filtering
        designer_access_correct = True
        if success2 and 'events' in designer_events:
            for event in designer_events['events']:
                if event.get('type') == 'task':
                    # Designer should only see tasks assigned to them
                    if event.get('assigned_to') != self.designer_user_id:
                        designer_access_correct = False
                        print(f"   ❌ Designer sees task not assigned to them: {event.get('id')}")
                        break
        
        admin_count = len(admin_events.get('events', [])) if success1 else 0
        designer_count = len(designer_events.get('events', [])) if success2 else 0
        
        print(f"   ✓ Admin events count: {admin_count}")
        print(f"   ✓ Designer events count: {designer_count}")
        print(f"   ✓ Designer access filtering correct: {designer_access_correct}")
        
        return success1 and success2 and designer_access_correct

    def test_calendar_events_project_filter(self):
        """Test calendar events project filtering"""
        if not self.test_project_id:
            print("   ⚠️ No test project available for project filter test")
            return True
        
        success, events_data = self.run_test("Calendar Events (Project Filter)", "GET", 
                                            f"api/calendar-events?project_id={self.test_project_id}", 200,
                                            auth_token=self.admin_token)
        if success and 'events' in events_data:
            # Verify all events are from the specified project
            project_filter_works = True
            for event in events_data['events']:
                if event.get('project_id') != self.test_project_id:
                    project_filter_works = False
                    break
            
            print(f"   ✓ Project filter works: {project_filter_works}")
            print(f"   ✓ Filtered events count: {len(events_data['events'])}")
            
            return success and project_filter_works
        return success

    def run_all_tests(self):
        """Run all calendar system tests"""
        print("🗓️ Starting Calendar System Tests for Arkiflo...")
        print(f"   Base URL: {self.base_url}")
        
        # Setup test users
        if not self.setup_test_users():
            print("❌ Failed to setup test users. Exiting.")
            return
        
        # Seed projects to get milestones
        if not self.seed_projects():
            print("❌ Failed to seed projects. Exiting.")
            return
        
        print("\n📋 Testing Task System...")
        
        # Task System tests
        self.test_create_task()
        self.test_create_standalone_task()
        self.test_list_tasks()
        self.test_task_role_permissions()
        self.test_update_task()
        self.test_task_validation()
        
        print("\n🗓️ Testing Calendar Events...")
        
        # Calendar Events tests
        self.test_calendar_events_basic()
        self.test_calendar_events_filters()
        self.test_calendar_events_color_coding()
        self.test_calendar_events_role_access()
        self.test_calendar_events_project_filter()
        
        # Print summary
        print(f"\n📊 Calendar System Test Summary:")
        print(f"   Total tests: {self.tests_run}")
        print(f"   Passed: {self.tests_passed}")
        print(f"   Failed: {len(self.failed_tests)}")
        print(f"   Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ Failed tests:")
            for failure in self.failed_tests:
                print(f"   - {failure['test']}")
                if 'expected' in failure:
                    print(f"     Expected: {failure['expected']}, Got: {failure['actual']}")
                if 'error' in failure:
                    print(f"     Error: {failure['error']}")
                if 'response' in failure:
                    print(f"     Response: {failure['response'][:100]}...")
        else:
            print(f"\n🎉 All Calendar System tests passed!")

if __name__ == "__main__":
    tester = CalendarSystemTester()
    tester.run_all_tests()