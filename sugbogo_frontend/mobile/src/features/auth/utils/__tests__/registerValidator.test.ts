import { validateRegisterForm } from "../registerValidator";

/**
 * @file registerValidator.test.ts
 * @description Unit tests for registration form validation.
 *
 * Verifies that registration input validation correctly
 * handles required fields, email validation, password rules,
 * password confirmation, and accepts valid registration data.
 *
 * Run:
 * npm test -- registerValidator.test.ts
 */

describe("registerValidator", () => {
  describe("validateRegisterForm", () => {
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
