import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "database.db");

function migrateUserLastConfig() {
  console.log("🔄 Starting migration: Add last_config_id to users table");

  const db = new Database(DB_PATH);

  try {
    db.exec("BEGIN TRANSACTION");

    // Check if column already exists
    const tableInfo = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
    const hasLastConfigId = tableInfo.some(col => col.name === "last_config_id");

    if (hasLastConfigId) {
      console.log("⚠️  Column last_config_id already exists, skipping migration");
      db.exec("ROLLBACK");
      db.close();
      return;
    }

    console.log("\n📊 Adding last_config_id column to users table...");

    // Add last_config_id column with default value "default"
    db.exec(`
      ALTER TABLE users ADD COLUMN last_config_id TEXT DEFAULT 'default';
    `);

    console.log("   ✓ Column added successfully");

    db.exec("COMMIT");
    console.log("\n✅ Migration completed successfully!");

    // Verify the migration
    console.log("\n🔍 Verification:");
    const verifyInfo = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string; type: string }>;
    const lastConfigCol = verifyInfo.find(col => col.name === "last_config_id");

    if (lastConfigCol) {
      console.log(`  - last_config_id column: ✓ (${lastConfigCol.type})`);
    } else {
      console.log("  - last_config_id column: ✗ (not found)");
    }

    // Show current users
    const users = db.prepare("SELECT id, username, last_config_id FROM users").all() as Array<{
      id: number;
      username: string;
      last_config_id: string;
    }>;

    console.log(`\n  Users (${users.length}):`);
    users.forEach(user => {
      console.log(`    - ID: ${user.id}, Username: "${user.username}", Last Config: "${user.last_config_id}"`);
    });

  } catch (error) {
    db.exec("ROLLBACK");
    console.error("\n❌ Migration failed:", error);
    throw error;
  } finally {
    db.close();
  }
}

migrateUserLastConfig();
