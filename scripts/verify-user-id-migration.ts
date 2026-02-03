import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "database.db");

function verifyMigration() {
  console.log("🔍 Verifying user_id migration...\n");

  const db = new Database(DB_PATH);

  try {
    // Check users table structure
    console.log("1️⃣ Checking users table:");
    const usersInfo = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string; type: string; pk: number }>;
    const hasIdPK = usersInfo.some(col => col.name === "id" && col.type === "INTEGER" && col.pk === 1);
    const hasUsername = usersInfo.some(col => col.name === "username" && col.type === "TEXT");
    console.log(`   - id (INTEGER PK): ${hasIdPK ? "✓" : "✗"}`);
    console.log(`   - username (TEXT UNIQUE): ${hasUsername ? "✓" : "✗"}`);

    // Check configurations table structure
    console.log("\n2️⃣ Checking configurations table:");
    const configsInfo = db.prepare("PRAGMA table_info(configurations)").all() as Array<{ name: string; type: string }>;
    const hasUserId = configsInfo.some(col => col.name === "user_id" && col.type === "INTEGER");
    const noUsername = !configsInfo.some(col => col.name === "username");
    console.log(`   - user_id (INTEGER): ${hasUserId ? "✓" : "✗"}`);
    console.log(`   - no username column: ${noUsername ? "✓" : "✗"}`);

    // Check auth_tokens table structure
    console.log("\n3️⃣ Checking auth_tokens table:");
    const tokensInfo = db.prepare("PRAGMA table_info(auth_tokens)").all() as Array<{ name: string; type: string }>;
    const hasTokenUserId = tokensInfo.some(col => col.name === "user_id" && col.type === "INTEGER");
    const noTokenUsername = !tokensInfo.some(col => col.name === "username");
    console.log(`   - user_id (INTEGER): ${hasTokenUserId ? "✓" : "✗"}`);
    console.log(`   - no username column: ${noTokenUsername ? "✓" : "✗"}`);

    // Check foreign keys
    console.log("\n4️⃣ Checking foreign key relationships:");
    const configsFK = db.prepare("PRAGMA foreign_key_list(configurations)").all() as Array<{ table: string; from: string; to: string }>;
    const hasUserFK = configsFK.some(fk => fk.table === "users" && fk.from === "user_id" && fk.to === "id");
    console.log(`   - configurations.user_id → users.id: ${hasUserFK ? "✓" : "✗"}`);

    const tokensFK = db.prepare("PRAGMA foreign_key_list(auth_tokens)").all() as Array<{ table: string; from: string; to: string }>;
    const hasTokenUserFK = tokensFK.some(fk => fk.table === "users" && fk.from === "user_id" && fk.to === "id");
    console.log(`   - auth_tokens.user_id → users.id: ${hasTokenUserFK ? "✓" : "✗"}`);

    // Check data integrity
    console.log("\n5️⃣ Checking data integrity:");

    const users = db.prepare("SELECT id, username FROM users").all() as Array<{ id: number; username: string }>;
    console.log(`   - Users: ${users.length}`);
    users.forEach(user => {
      console.log(`      • ID: ${user.id}, Username: "${user.username}"`);

      // Check configurations for this user
      const configs = db.prepare("SELECT id, config_id FROM configurations WHERE user_id = ?").all(user.id) as Array<{ id: number; config_id: string }>;
      console.log(`        - Configurations: ${configs.length}`);
      configs.forEach(config => {
        console.log(`          • Config ID: ${config.id}, Name: "${config.config_id}"`);

        // Check versions for this config
        const versions = db.prepare("SELECT COUNT(*) as count FROM configuration_versions WHERE configuration_id = ?").get(config.id) as { count: number };
        console.log(`            - Versions: ${versions.count}`);
      });

      // Check auth tokens for this user
      const tokens = db.prepare("SELECT COUNT(*) as count FROM auth_tokens WHERE user_id = ?").get(user.id) as { count: number };
      console.log(`        - Auth tokens: ${tokens.count}`);
    });

    // Final summary
    console.log("\n" + "=".repeat(50));
    if (hasIdPK && hasUsername && hasUserId && noUsername && hasTokenUserId && noTokenUsername && hasUserFK && hasTokenUserFK && users.length > 0) {
      console.log("✅ All checks passed! Migration successful.");
    } else {
      console.log("❌ Some checks failed. Please review the output above.");
    }
    console.log("=".repeat(50));

  } catch (error) {
    console.error("\n❌ Verification failed:", error);
    throw error;
  } finally {
    db.close();
  }
}

verifyMigration();
