import { validateLoginForm } from "../loginValidator";

/**
 * @file loginValidator.test.ts
 * @description Unit tests for login form validation.
 *
 * Verifies that login input validation correctly
 * handles missing fields, invalid email formats,
 * and accepts valid login credentials.
 *
 * Run:
 * npm test -- loginValidator.test.ts
 */

describe("loginValidator", () => {
  describe("validateLoginForm", () => {
    // Test Case 1
    it("should require both email and password", () => {
      // Arrange
      const email = "";
      const password = "";

      // Act
      const result = validateLoginForm(email, password);

      // Assert
      expect(result).toEqual({
        email: "Email is required.",
        password: "Password is required.",
      });
    });

    // Test Case 2
    it("should reject an invalid email address", () => {
      // Arrange
      const email = "john";
      const password = "Password123!";

      // Act
      const result = validateLoginForm(email, password);

      // Assert
      expect(result.email).toBe("Enter a valid email address.");
    });

    // Test Case 3
    it("should require a password", () => {
      // Arrange
      const email = "john@example.com";
      const password = "";

      // Act
      const result = validateLoginForm(email, password);

      // Assert
      expect(result.password).toBe("Password is required.");
    });

    // Test Case 4
    it("should return no validation errors for valid input", () => {
      // Arrange
      const email = "john@example.com";
      const password = "Password123!";

      // Act
      const result = validateLoginForm(email, password);

      // Assert
      expect(result).toEqual({});
    });
  });
});
