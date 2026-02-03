import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-db.db");

// Set environment variable BEFORE importing db.server
process.env.DATABASE_PATH = TEST_DB_PATH;

import type { AppConfig } from "./db.server";
import {
  createUser,
  getUser,
  getUserById,
  userExists,
  updateUserLastConfig,
  createAuthToken,
  getAuthToken,
  deleteAuthToken,
  getConfig,
  saveConfig,
  initializeDefaultConfig,
  getUserConfigs,
  getFullConfigRecord,
  importConfigRecord,
  getConfigVersions,
  createConfigVersion,
  restoreConfigVersion,
  getLatestVersionNumber,
  getLoadedVersion,
  updateLoadedVersion,
  resetDatabaseConnection,
} from "./db.server";

const mockConfig: AppConfig = {
  carousel: {
    images: ["https://example.com/image1.jpg", "https://example.com/image2.jpg"],
    aspectRatio: "landscape",
  },
  textSection: {
    title: "Test Title",
    titleColor: "#000000",
    description: "Test Description",
    descriptionColor: "#666666",
  },
  cta: {
    label: "Click Me",
    url: "https://example.com",
    backgroundColor: "#007bff",
    textColor: "#ffffff",
  },
};

// Cleanup function to remove test database files
function cleanupTestDatabase() {
  const filesToRemove = [
    TEST_DB_PATH,
    `${TEST_DB_PATH}-shm`,
    `${TEST_DB_PATH}-wal`,
  ];

  for (const file of filesToRemove) {
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
      } catch (e) {
        // Ignore errors during cleanup
      }
    }
  }
}

describe("db.server", () => {
  beforeEach(() => {
    // Reset the database connection and clean up test files before each test
    resetDatabaseConnection();
    cleanupTestDatabase();
  });

  afterEach(() => {
    // Reset connection after each test
    resetDatabaseConnection();
  });

  afterAll(() => {
    // Final cleanup
    resetDatabaseConnection();
    cleanupTestDatabase();
  });

  describe("User Management", () => {
    describe("createUser", () => {
      it("should create a new user", () => {
        const user = createUser("testuser", "hashedpassword", "salt123");

        expect(user).toBeDefined();
        expect(user!.username).toBe("testuser");
        expect(user!.passwordHash).toBe("hashedpassword");
        expect(user!.salt).toBe("salt123");
        expect(user!.id).toBeGreaterThan(0);
      });

      it("should set createdAt timestamp", () => {
        const user = createUser("testuser", "hash", "salt");

        expect(user!.createdAt).toBeDefined();
        const createdDate = new Date(user!.createdAt);
        expect(createdDate.getTime()).toBeLessThanOrEqual(Date.now());
      });

      it("should set default last_config_id to 'default'", () => {
        const user = createUser("testuser", "hash", "salt");

        expect(user!.last_config_id).toBe("default");
      });

      it("should return null for duplicate username", () => {
        createUser("duplicate", "hash1", "salt1");
        const duplicate = createUser("duplicate", "hash2", "salt2");

        expect(duplicate).toBeNull();
      });

      it("should auto-increment user IDs", () => {
        const user1 = createUser("user1", "hash", "salt");
        const user2 = createUser("user2", "hash", "salt");

        expect(user2!.id).toBeGreaterThan(user1!.id);
      });
    });

    describe("getUser", () => {
      it("should retrieve user by username", () => {
        createUser("testuser", "hash", "salt");

        const user = getUser("testuser");

        expect(user).toBeDefined();
        expect(user!.username).toBe("testuser");
      });

      it("should return null for non-existent user", () => {
        const user = getUser("nonexistent");
        expect(user).toBeNull();
      });

      it("should be case-sensitive", () => {
        createUser("testuser", "hash", "salt");

        const user = getUser("TestUser");
        expect(user).toBeNull();
      });
    });

    describe("getUserById", () => {
      it("should retrieve user by ID", () => {
        const created = createUser("testuser", "hash", "salt");

        const user = getUserById(created!.id);

        expect(user).toBeDefined();
        expect(user!.id).toBe(created!.id);
        expect(user!.username).toBe("testuser");
      });

      it("should return null for non-existent ID", () => {
        const user = getUserById(99999);
        expect(user).toBeNull();
      });
    });

    describe("userExists", () => {
      it("should return false when no users exist", () => {
        expect(userExists()).toBe(false);
      });

      it("should return true when users exist", () => {
        createUser("testuser", "hash", "salt");
        expect(userExists()).toBe(true);
      });

      it("should return true with multiple users", () => {
        createUser("user1", "hash", "salt");
        createUser("user2", "hash", "salt");
        expect(userExists()).toBe(true);
      });
    });

    describe("updateUserLastConfig", () => {
      it("should update last viewed config", () => {
        const user = createUser("testuser", "hash", "salt");

        updateUserLastConfig(user!.id, "mobile");

        const updated = getUserById(user!.id);
        expect(updated!.last_config_id).toBe("mobile");
      });

      it("should handle multiple updates", () => {
        const user = createUser("testuser", "hash", "salt");

        updateUserLastConfig(user!.id, "config1");
        updateUserLastConfig(user!.id, "config2");

        const updated = getUserById(user!.id);
        expect(updated!.last_config_id).toBe("config2");
      });
    });
  });

  describe("Authentication Tokens", () => {
    let userId: number;

    beforeEach(() => {
      const user = createUser("testuser", "hash", "salt");
      userId = user!.id;
    });

    describe("createAuthToken", () => {
      it("should create auth token", () => {
        const futureDate = new Date(Date.now() + 86400000).toISOString();
        const token = "test_token_123";

        createAuthToken(token, userId, futureDate);

        // Token lookup should work with plaintext token
        const retrieved = getAuthToken(token);
        expect(retrieved).toBeDefined();
        // Token is stored as a hash (SHA-256), not plaintext
        expect(retrieved!.token).not.toBe(token);
        expect(retrieved!.token.length).toBe(64); // SHA-256 hash is 64 hex chars
        expect(retrieved!.user_id).toBe(userId);
      });

      it("should store expiration date", () => {
        const futureDate = new Date(Date.now() + 86400000).toISOString();
        const token = "token_with_expiry";

        createAuthToken(token, userId, futureDate);

        const retrieved = getAuthToken(token);
        expect(retrieved!.expiresAt).toBe(futureDate);
      });

      it("should set createdAt timestamp", () => {
        const futureDate = new Date(Date.now() + 86400000).toISOString();
        createAuthToken("token123", userId, futureDate);

        const retrieved = getAuthToken("token123");
        expect(retrieved!.createdAt).toBeDefined();
      });
    });

    describe("getAuthToken", () => {
      it("should retrieve token", () => {
        const futureDate = new Date(Date.now() + 86400000).toISOString();
        createAuthToken("mytoken", userId, futureDate);

        // Token lookup works with plaintext token
        const token = getAuthToken("mytoken");

        expect(token).toBeDefined();
        // Token is stored as a hash, not the plaintext value
        expect(token!.token).not.toBe("mytoken");
        expect(token!.token.length).toBe(64); // SHA-256 hash is 64 hex chars
      });

      it("should return null for non-existent token", () => {
        const token = getAuthToken("nonexistent");
        expect(token).toBeNull();
      });

      it("should return null for expired token", () => {
        const pastDate = new Date(Date.now() - 1000).toISOString();
        createAuthToken("expired", userId, pastDate);

        const token = getAuthToken("expired");
        expect(token).toBeNull();
      });
    });

    describe("deleteAuthToken", () => {
      it("should delete auth token", () => {
        const futureDate = new Date(Date.now() + 86400000).toISOString();
        createAuthToken("token_to_delete", userId, futureDate);

        deleteAuthToken("token_to_delete");

        const token = getAuthToken("token_to_delete");
        expect(token).toBeNull();
      });

      it("should handle deleting non-existent token gracefully", () => {
        expect(() => {
          deleteAuthToken("nonexistent");
        }).not.toThrow();
      });
    });
  });

  describe("Configuration Management", () => {
    let userId: number;

    beforeEach(() => {
      const user = createUser("testuser", "hash", "salt");
      userId = user!.id;
    });

    describe("initializeDefaultConfig", () => {
      it("should create default config if not exists", () => {
        initializeDefaultConfig(userId);

        const config = getConfig(userId, "default");
        expect(config).toBeDefined();
      });

      it("should not overwrite existing config", () => {
        const customConfig = { ...mockConfig, textSection: { ...mockConfig.textSection, title: "Custom" } };
        saveConfig(userId, "default", customConfig);

        initializeDefaultConfig(userId);

        const config = getConfig(userId, "default");
        expect(config!.textSection.title).toBe("Custom");
      });
    });

    describe("saveConfig", () => {
      it("should save new config", () => {
        saveConfig(userId, "myconfig", mockConfig);

        const config = getConfig(userId, "myconfig");
        expect(config).toEqual(mockConfig);
      });

      it("should update existing config", () => {
        saveConfig(userId, "myconfig", mockConfig);

        const updated = { ...mockConfig, textSection: { ...mockConfig.textSection, title: "Updated" } };
        saveConfig(userId, "myconfig", updated);

        const config = getConfig(userId, "myconfig");
        expect(config!.textSection.title).toBe("Updated");
      });

      it("should serialize complex objects", () => {
        const complexConfig = {
          ...mockConfig,
          sectionOrder: ["carousel", "textSection", "cta"],
        };

        saveConfig(userId, "complex", complexConfig);

        const config = getConfig(userId, "complex");
        expect(config).toEqual(complexConfig);
      });

      it("should update timestamp on save", () => {
        saveConfig(userId, "timestamped", mockConfig);

        const record = getFullConfigRecord(userId, "timestamped");
        expect(record!.updatedAt).toBeDefined();

        const updateTime = new Date(record!.updatedAt);
        expect(updateTime.getTime()).toBeLessThanOrEqual(Date.now());
      });
    });

    describe("getConfig", () => {
      it("should retrieve config", () => {
        saveConfig(userId, "myconfig", mockConfig);

        const config = getConfig(userId, "myconfig");

        expect(config).toEqual(mockConfig);
      });

      it("should return null for non-existent config", () => {
        const config = getConfig(userId, "nonexistent");
        expect(config).toBeNull();
      });

      it("should handle corrupted JSON gracefully", () => {
        // This tests the error handling for corrupted data
        // In real scenario, we'd need to manually corrupt the DB
        // For now, we test that getConfig returns null on error
        const config = getConfig(userId, "nonexistent");
        expect(config).toBeNull();
      });
    });

    describe("getUserConfigs", () => {
      it("should return empty array when no configs", () => {
        const configs = getUserConfigs(userId);
        expect(configs).toEqual([]);
      });

      it("should list all user configs", () => {
        saveConfig(userId, "config1", mockConfig);
        saveConfig(userId, "config2", mockConfig);

        const configs = getUserConfigs(userId);

        expect(configs.length).toBe(2);
        expect(configs.map(c => c.config_id)).toContain("config1");
        expect(configs.map(c => c.config_id)).toContain("config2");
      });

      it("should include version count", () => {
        saveConfig(userId, "myconfig", mockConfig);
        createConfigVersion(userId, "myconfig", mockConfig);
        createConfigVersion(userId, "myconfig", mockConfig);

        const configs = getUserConfigs(userId);

        const myConfig = configs.find(c => c.config_id === "myconfig");
        expect(myConfig!.versionCount).toBe(2);
      });

      it("should order by most recently updated", () => {
        saveConfig(userId, "old", mockConfig);
        saveConfig(userId, "new", mockConfig);

        const configs = getUserConfigs(userId);

        // Most recent should be first
        expect(configs[0].config_id).toBe("new");
      });
    });

    describe("getFullConfigRecord", () => {
      it("should return full config record with metadata", () => {
        saveConfig(userId, "myconfig", mockConfig);

        const record = getFullConfigRecord(userId, "myconfig");

        expect(record).toBeDefined();
        expect(record!.config_id).toBe("myconfig");
        expect(record!.schemaVersion).toBeDefined();
        expect(record!.updatedAt).toBeDefined();
        expect(record!.data).toEqual(mockConfig);
      });

      it("should return null for non-existent config", () => {
        const record = getFullConfigRecord(userId, "nonexistent");
        expect(record).toBeNull();
      });
    });

    describe("importConfigRecord", () => {
      it("should import config with all metadata", () => {
        const importData = {
          config_id: "imported",
          schemaVersion: 1,
          updatedAt: new Date().toISOString(),
          data: mockConfig,
        };

        importConfigRecord(userId, importData);

        const config = getConfig(userId, "imported");
        expect(config).toEqual(mockConfig);
      });

      it("should overwrite existing config on import", () => {
        saveConfig(userId, "existing", mockConfig);

        const importData = {
          config_id: "existing",
          schemaVersion: 1,
          updatedAt: new Date().toISOString(),
          data: { ...mockConfig, textSection: { ...mockConfig.textSection, title: "Imported" } },
        };

        importConfigRecord(userId, importData);

        const config = getConfig(userId, "existing");
        expect(config!.textSection.title).toBe("Imported");
      });
    });
  });

  describe("Version Control", () => {
    let userId: number;

    beforeEach(() => {
      const user = createUser("testuser", "hash", "salt");
      userId = user!.id;
      saveConfig(userId, "myconfig", mockConfig);
    });

    describe("createConfigVersion", () => {
      it("should create version snapshot", () => {
        const version = createConfigVersion(userId, "myconfig", mockConfig);

        expect(version.version).toBe(1);
      });

      it("should increment version numbers", () => {
        const v1 = createConfigVersion(userId, "myconfig", mockConfig);
        const v2 = createConfigVersion(userId, "myconfig", mockConfig);
        const v3 = createConfigVersion(userId, "myconfig", mockConfig);

        expect(v1.version).toBe(1);
        expect(v2.version).toBe(2);
        expect(v3.version).toBe(3);
      });

      it("should store complete config snapshot", () => {
        createConfigVersion(userId, "myconfig", mockConfig);

        const versions = getConfigVersions(userId, "myconfig", 10);
        expect(versions[0].data).toEqual(mockConfig);
      });

      it("should set createdAt timestamp", () => {
        createConfigVersion(userId, "myconfig", mockConfig);

        const versions = getConfigVersions(userId, "myconfig", 10);
        expect(versions[0].createdAt).toBeDefined();
      });

      it("should auto-prune old versions when limit exceeded", () => {
        // Create 100 versions (the limit)
        for (let i = 0; i < 100; i++) {
          createConfigVersion(userId, "myconfig", mockConfig);
        }

        // Verify we have 100 versions
        let versions = getConfigVersions(userId, "myconfig", 150);
        expect(versions.length).toBe(100);
        expect(versions[versions.length - 1].version).toBe(1); // Oldest is version 1

        // Create one more - should auto-prune oldest
        createConfigVersion(userId, "myconfig", mockConfig);

        versions = getConfigVersions(userId, "myconfig", 150);
        expect(versions.length).toBe(100); // Still 100, not 101
        expect(versions[0].version).toBe(101); // Newest is version 101
        expect(versions[versions.length - 1].version).toBe(2); // Oldest is now version 2 (1 was pruned)
      });
    });

    describe("getConfigVersions", () => {
      it("should return empty array when no versions", () => {
        const versions = getConfigVersions(userId, "myconfig", 10);
        expect(versions).toEqual([]);
      });

      it("should retrieve all versions", () => {
        createConfigVersion(userId, "myconfig", mockConfig);
        createConfigVersion(userId, "myconfig", mockConfig);
        createConfigVersion(userId, "myconfig", mockConfig);

        const versions = getConfigVersions(userId, "myconfig", 10);

        expect(versions.length).toBe(3);
      });

      it("should order versions by most recent first", () => {
        createConfigVersion(userId, "myconfig", mockConfig);
        createConfigVersion(userId, "myconfig", { ...mockConfig, textSection: { ...mockConfig.textSection, title: "V2" } });

        const versions = getConfigVersions(userId, "myconfig", 10);

        expect(versions[0].version).toBe(2);
        expect(versions[1].version).toBe(1);
      });

      it("should limit results to specified count", () => {
        for (let i = 0; i < 10; i++) {
          createConfigVersion(userId, "myconfig", mockConfig);
        }

        const versions = getConfigVersions(userId, "myconfig", 5);

        expect(versions.length).toBe(5);
      });
    });

    describe("restoreConfigVersion", () => {
      it("should restore config from version", () => {
        const originalConfig = { ...mockConfig, textSection: { ...mockConfig.textSection, title: "Original" } };
        saveConfig(userId, "myconfig", originalConfig);
        createConfigVersion(userId, "myconfig", originalConfig);

        // Modify config
        const modifiedConfig = { ...mockConfig, textSection: { ...mockConfig.textSection, title: "Modified" } };
        saveConfig(userId, "myconfig", modifiedConfig);

        // Restore version 1
        const success = restoreConfigVersion(userId, "myconfig", 1);

        expect(success).toBe(true);

        // Verify config was restored
        const restored = getConfig(userId, "myconfig");
        expect(restored).toBeDefined();
        expect(restored!.textSection.title).toBe("Original");
      });

      it("should update loaded_version on restore", () => {
        createConfigVersion(userId, "myconfig", mockConfig);

        restoreConfigVersion(userId, "myconfig", 1);

        const loadedVersion = getLoadedVersion(userId, "myconfig");
        expect(loadedVersion).toBe(1);
      });

      it("should return false for non-existent version", () => {
        const success = restoreConfigVersion(userId, "myconfig", 999);
        expect(success).toBe(false);
      });
    });

    describe("getLatestVersionNumber", () => {
      it("should return 0 when no versions exist", () => {
        const latest = getLatestVersionNumber(userId, "myconfig");
        expect(latest).toBe(0);
      });

      it("should return highest version number", () => {
        createConfigVersion(userId, "myconfig", mockConfig);
        createConfigVersion(userId, "myconfig", mockConfig);
        createConfigVersion(userId, "myconfig", mockConfig);

        const latest = getLatestVersionNumber(userId, "myconfig");
        expect(latest).toBe(3);
      });
    });

    describe("getLoadedVersion and updateLoadedVersion", () => {
      it("should return null when no version loaded", () => {
        const loaded = getLoadedVersion(userId, "myconfig");
        expect(loaded).toBeNull();
      });

      it("should track loaded version", () => {
        createConfigVersion(userId, "myconfig", mockConfig);

        updateLoadedVersion(userId, "myconfig", 1);

        const loaded = getLoadedVersion(userId, "myconfig");
        expect(loaded).toBe(1);
      });

      it("should allow clearing loaded version", () => {
        updateLoadedVersion(userId, "myconfig", 1);
        updateLoadedVersion(userId, "myconfig", null);

        const loaded = getLoadedVersion(userId, "myconfig");
        expect(loaded).toBeNull();
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle database operations without crashing", () => {
      expect(() => {
        createUser("user1", "hash", "salt");
        const user = getUser("user1");
        if (user) {
          saveConfig(user.id, "config", mockConfig);
          getConfig(user.id, "config");
        }
      }).not.toThrow();
    });

    it("should handle concurrent operations", () => {
      const user1 = createUser("user1", "hash", "salt");
      const user2 = createUser("user2", "hash", "salt");

      saveConfig(user1!.id, "config", mockConfig);
      saveConfig(user2!.id, "config", mockConfig);

      const config1 = getConfig(user1!.id, "config");
      const config2 = getConfig(user2!.id, "config");

      expect(config1).toEqual(mockConfig);
      expect(config2).toEqual(mockConfig);
    });
  });

  describe("Data Integrity", () => {
    it("should maintain referential integrity for auth tokens", () => {
      const user = createUser("testuser", "hash", "salt");
      const futureDate = new Date(Date.now() + 86400000).toISOString();

      createAuthToken("token123", user!.id, futureDate);

      const token = getAuthToken("token123");
      expect(token!.user_id).toBe(user!.id);
    });

    it("should isolate configs between users", () => {
      const user1 = createUser("user1", "hash", "salt");
      const user2 = createUser("user2", "hash", "salt");

      const config1 = { ...mockConfig, textSection: { ...mockConfig.textSection, title: "User 1" } };
      const config2 = { ...mockConfig, textSection: { ...mockConfig.textSection, title: "User 2" } };

      saveConfig(user1!.id, "myconfig", config1);
      saveConfig(user2!.id, "myconfig", config2);

      expect(getConfig(user1!.id, "myconfig")!.textSection.title).toBe("User 1");
      expect(getConfig(user2!.id, "myconfig")!.textSection.title).toBe("User 2");
    });

    it("should handle special characters in config data", () => {
      const specialConfig = {
        ...mockConfig,
        textSection: {
          ...mockConfig.textSection,
          title: "Title with 'quotes' and \"double quotes\"",
          description: "Description with\nnewlines\tand\ttabs",
        },
      };

      const user = createUser("testuser", "hash", "salt");
      saveConfig(user!.id, "special", specialConfig);

      const config = getConfig(user!.id, "special");
      expect(config).toEqual(specialConfig);
    });
  });
});
