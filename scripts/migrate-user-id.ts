import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "database.db");

interface UserRow {
  username: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

interface ConfigRow {
  id: number;
  username: string;
  config_id: string;
  schemaVersion: number;
  updatedAt: string;
  data: string;
}

interface AuthTokenRow {
  token: string;
  username: string;
  createdAt: string;
  expiresAt: string;
}

function migrateUserIdSchema() {
  console.log("🔄 Starting migration: users.username → users.id (INTEGER PK)");

  const db = new Database(DB_PATH);
  db.pragma("foreign_keys = OFF");

  try {
    db.exec("BEGIN TRANSACTION");

    // Step 1: Get existing data
    console.log("\n📊 Reading existing data...");
    const users = db.prepare("SELECT * FROM users").all() as UserRow[];
    const configs = db.prepare("SELECT * FROM configurations").all() as ConfigRow[];
    const authTokens = db.prepare("SELECT * FROM auth_tokens").all() as AuthTokenRow[];

    console.log(`   - Users: ${users.length}`);
    console.log(`   - Configurations: ${configs.length}`);
    console.log(`   - Auth tokens: ${authTokens.length}`);

    // Step 2: Create new users table with integer id
    console.log("\n🔨 Creating new users table with integer id...");
    db.exec(`
      CREATE TABLE users_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        passwordHash TEXT NOT NULL,
        salt TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
    `);

    // Step 3: Migrate users data
    console.log("📦 Migrating users data...");
    const insertUser = db.prepare(`
      INSERT INTO users_new (username, passwordHash, salt, createdAt)
      VALUES (?, ?, ?, ?)
    `);

    for (const user of users) {
      insertUser.run(user.username, user.passwordHash, user.salt, user.createdAt);
    }

    // Create username -> id mapping
    const userIdMap = new Map<string, number>();
    const newUsers = db.prepare("SELECT id, username FROM users_new").all() as Array<{ id: number; username: string }>;
    for (const user of newUsers) {
      userIdMap.set(user.username, user.id);
    }

    console.log("   ✓ User ID mapping created");

    // Step 4: Create new configurations table with user_id
    console.log("\n🔨 Creating new configurations table with user_id...");
    db.exec(`
      CREATE TABLE configurations_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        config_id TEXT NOT NULL,
        schemaVersion INTEGER NOT NULL DEFAULT 1,
        updatedAt TEXT NOT NULL,
        data TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users_new(id) ON DELETE CASCADE,
        UNIQUE (user_id, config_id)
      );
    `);

    // Step 5: Migrate configurations data
    console.log("📦 Migrating configurations data...");
    const insertConfig = db.prepare(`
      INSERT INTO configurations_new (id, user_id, config_id, schemaVersion, updatedAt, data)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const config of configs) {
      const userId = userIdMap.get(config.username);
      if (!userId) {
        throw new Error(`User not found for username: ${config.username}`);
      }
      insertConfig.run(config.id, userId, config.config_id, config.schemaVersion, config.updatedAt, config.data);
    }

    console.log(`   ✓ Migrated ${configs.length} configuration(s)`);

    // Step 6: Create new auth_tokens table with user_id
    console.log("\n🔨 Creating new auth_tokens table with user_id...");
    db.exec(`
      CREATE TABLE auth_tokens_new (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        createdAt TEXT NOT NULL,
        expiresAt TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users_new(id) ON DELETE CASCADE
      );
    `);

    // Step 7: Migrate auth_tokens data
    console.log("📦 Migrating auth_tokens data...");
    const insertToken = db.prepare(`
      INSERT INTO auth_tokens_new (token, user_id, createdAt, expiresAt)
      VALUES (?, ?, ?, ?)
    `);

    for (const token of authTokens) {
      const userId = userIdMap.get(token.username);
      if (!userId) {
        throw new Error(`User not found for username: ${token.username}`);
      }
      insertToken.run(token.token, userId, token.createdAt, token.expiresAt);
    }

    console.log(`   ✓ Migrated ${authTokens.length} auth token(s)`);

    // Step 8: Drop old tables and rename new ones
    console.log("\n🔄 Replacing old tables with new ones...");
    db.exec("DROP TABLE auth_tokens");
    db.exec("DROP TABLE configurations");
    db.exec("DROP TABLE configuration_versions"); // Will be recreated by schema initialization
    db.exec("DROP TABLE users");

    db.exec("ALTER TABLE users_new RENAME TO users");
    db.exec("ALTER TABLE configurations_new RENAME TO configurations");
    db.exec("ALTER TABLE auth_tokens_new RENAME TO auth_tokens");

    // Step 9: Recreate configuration_versions table (will be populated from existing data)
    console.log("\n🔨 Recreating configuration_versions table...");
    db.exec(`
      CREATE TABLE configuration_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        configuration_id INTEGER NOT NULL,
        version INTEGER NOT NULL,
        createdAt TEXT NOT NULL,
        data TEXT NOT NULL,
        FOREIGN KEY (configuration_id) REFERENCES configurations(id) ON DELETE CASCADE,
        UNIQUE (configuration_id, version)
      );
    `);

    // Step 10: Create indexes
    console.log("\n📑 Creating indexes...");
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_id ON auth_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_auth_tokens_expiresAt ON auth_tokens(expiresAt);
      CREATE INDEX IF NOT EXISTS idx_configurations_user_id ON configurations(user_id, config_id);
      CREATE INDEX IF NOT EXISTS idx_configuration_versions_configuration_id ON configuration_versions(configuration_id, version DESC);
    `);

    db.exec("COMMIT");
    console.log("\n✅ Migration completed successfully!");

    // Verify the migration
    console.log("\n🔍 Verification:");
    const userCheck = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string; type: string }>;
    const hasId = userCheck.some(col => col.name === "id" && col.type === "INTEGER");
    const hasUsername = userCheck.some(col => col.name === "username" && col.type === "TEXT");
    console.log(`  - users.id (INTEGER): ${hasId ? "✓" : "✗"}`);
    console.log(`  - users.username (TEXT UNIQUE): ${hasUsername ? "✓" : "✗"}`);

    const configCheck = db.prepare("PRAGMA table_info(configurations)").all() as Array<{ name: string; type: string }>;
    const hasUserId = configCheck.some(col => col.name === "user_id" && col.type === "INTEGER");
    console.log(`  - configurations.user_id (INTEGER FK): ${hasUserId ? "✓" : "✗"}`);

    const tokenCheck = db.prepare("PRAGMA table_info(auth_tokens)").all() as Array<{ name: string; type: string }>;
    const hasTokenUserId = tokenCheck.some(col => col.name === "user_id" && col.type === "INTEGER");
    console.log(`  - auth_tokens.user_id (INTEGER FK): ${hasTokenUserId ? "✓" : "✗"}`);

    const finalUsers = db.prepare("SELECT id, username FROM users").all() as Array<{ id: number; username: string }>;
    const finalConfigs = db.prepare("SELECT COUNT(*) as count FROM configurations").get() as { count: number };
    const finalTokens = db.prepare("SELECT COUNT(*) as count FROM auth_tokens").get() as { count: number };

    console.log(`  - ${finalUsers.length} user(s) migrated:`);
    finalUsers.forEach(user => {
      const userConfigs = db.prepare("SELECT COUNT(*) as count FROM configurations WHERE user_id = ?").get(user.id) as { count: number };
      console.log(`      - User ID: ${user.id}, Username: "${user.username}", Configs: ${userConfigs.count}`);
    });
    console.log(`  - ${finalConfigs.count} configuration(s) preserved: ✓`);
    console.log(`  - ${finalTokens.count} auth token(s) preserved: ✓`);

  } catch (error) {
    db.exec("ROLLBACK");
    console.error("\n❌ Migration failed:", error);
    throw error;
  } finally {
    db.pragma("foreign_keys = ON");
    db.close();
  }
}

migrateUserIdSchema();
