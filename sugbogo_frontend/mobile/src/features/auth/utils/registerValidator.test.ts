import { validateRegisterForm } from "./registerValidator";

/**
 * registerValidator.test.ts
 *
 * Unit tests for registerValidator.
 *
 * These tests verify that client-side validation
 * behaves correctly before sending a request
 * to the backend.
 *
 * Test Cases
 * ----------
 * - should require all fields
 * - should reject an invalid email address
 * - should reject passwords shorter than 8 characters
 * - should reject passwords containing only numbers
 * - should reject common passwords
 * - should require password confirmation
 * - should reject mismatched passwords
 * - should return no validation errors for valid input
 */

describe("registerValidator", () => {
  describe("validateRegisterForm", () => {
    // Test Case 1:
    it("should require all fields", () => {
      // Arrange
      const firstName = "";
      const lastName = "";
      const email = "";
      const password = "";
      const confirmPassword = "";

      // Act
      const result = validateRegisterForm(
        firstName,
        lastName,
        email,
        password,
        confirmPassword,
      );

      // Assert
      expect(result).toEqual({
        firstName: "First name is required.",
        lastName: "Last name is required.",
        email: "Email is required.",
        password: "Password is required.",
        confirmPassword: "Please confirm your password.",
      });
    });

    // Test Case 2
    it("should reject an invalid email address", () => {
      // Arrange
      const firstName = "John";
      const lastName = "Doe";
      const email = "john";
      const password = "Password123!";
      const confirmPassword = "Password123!";

      // Act
      const result = validateRegisterForm(
        firstName,
        lastName,
        email,
        password,
        confirmPassword,
      );

      // Assert
      expect(result.email).toBe("Enter a valid email address.");
    });

    // Test Case 3
    it("should reject a password shorter than the minimum length", () => {
      // Arrange
      const firstName = "John";
      const lastName = "Doe";
      const email = "john@example.com";
      const password = "12345";
      const confirmPassword = "12345";

      // Act
      const result = validateRegisterForm(
        firstName,
        lastName,
        email,
        password,
        confirmPassword,
      );

      // Assert
      expect(result.password).toBe("Password must be at least 8 characters.");
    });

    // Test Case 4
    // Test Case 4
    it("should reject passwords containing only numbers", () => {
      // Arrange
      const firstName = "John";
      const lastName = "Doe";
      const email = "john@example.com";
      const password = "123456789";
      const confirmPassword = "123456789";

      // Act
      const result = validateRegisterForm(
        firstName,
        lastName,
        email,
        password,
        confirmPassword,
      );

      // Assert
      expect(result.password).toBe("Password cannot contain only numbers.");
    });

    // Test Case 5
    // Test Case 5
    it("should reject common passwords", () => {
      // Arrange
      const firstName = "John";
      const lastName = "Doe";
      const email = "john@example.com";
      const password = "password123";
      const confirmPassword = "password123";

      // Act
      const result = validateRegisterForm(
        firstName,
        lastName,
        email,
        password,
        confirmPassword,
      );

      // Assert
      expect(result.password).toBe("This password is too common.");
    });

    // Test Case 6
    // Test Case 6
    it("should require password confirmation", () => {
      // Arrange
      const firstName = "John";
      const lastName = "Doe";
      const email = "john@example.com";
      const password = "Password123!";
      const confirmPassword = "";

      // Act
      const result = validateRegisterForm(
        firstName,
        lastName,
        email,
        password,
        confirmPassword,
      );

      // Assert
      expect(result.confirmPassword).toBe("Please confirm your password.");
    });

    // Test Case 7
    it("should reject mismatched passwords", () => {
      // Arrange
      const firstName = "John";
      const lastName = "Doe";
      const email = "john@example.com";
      const password = "Password123!";
      const confirmPassword = "Password321!";

      // Act
      const result = validateRegisterForm(
        firstName,
        lastName,
        email,
        password,
        confirmPassword,
      );

      // Assert
      expect(result.confirmPassword).toBe("Passwords do not match.");
    });

    // Test Case 8
    it("should return no validation errors for valid input", () => {
      // Arrange
      const firstName = "John";
      const lastName = "Doe";
      const email = "john@example.com";
      const password = "Password123!";
      const confirmPassword = "Password123!";

      // Act
      const result = validateRegisterForm(
        firstName,
        lastName,
        email,
        password,
        confirmPassword,
      );

      // Assert
      expect(result).toEqual({});
    });
  });
});
