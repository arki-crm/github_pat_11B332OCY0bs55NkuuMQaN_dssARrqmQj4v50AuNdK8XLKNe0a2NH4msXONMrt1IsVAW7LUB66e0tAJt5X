// MongoDB Initialization Script
// This runs ONCE on first container startup when data volume is empty
// Creates application user in ADMIN database with readWrite role on arkiflo

// Get environment variables
const appUser = process.env.MONGO_APP_USER || 'arkiflo_app';
const appPassword = process.env.MONGO_APP_PASSWORD;

if (!appPassword) {
    print('ERROR: MONGO_APP_PASSWORD environment variable is required');
    quit(1);
}

// Switch to ADMIN database - this is where we create the user
// This is critical: user must be in admin db when using authSource=admin
db = db.getSiblingDB('admin');

// Check if user already exists (idempotent)
const existingUser = db.getUser(appUser);
if (existingUser) {
    print('User ' + appUser + ' already exists in admin database, skipping creation');
} else {
    // Create application user in ADMIN database
    db.createUser({
        user: appUser,
        pwd: appPassword,
        roles: [
            {
                role: 'readWrite',
                db: 'arkiflo'
            }
        ]
    });
    print('✓ Created user: ' + appUser + ' in admin database');
    print('✓ Granted readWrite role on arkiflo database');
}

// Initialize the arkiflo database by creating a collection
// This ensures the database exists and is visible to the app user
db = db.getSiblingDB('arkiflo');

// Create initial collections if they don't exist
const collections = ['users', 'projects', 'leads'];
collections.forEach(function(collName) {
    if (!db.getCollectionNames().includes(collName)) {
        db.createCollection(collName);
        print('✓ Created collection: ' + collName);
    }
});

print('');
print('========================================');
print('MongoDB initialization complete!');
print('App user: ' + appUser);
print('Database: arkiflo');
print('Auth source: admin');
print('========================================');
