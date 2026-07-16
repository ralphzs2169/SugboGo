import { mapLoginErrors, mapRegisterErrors } from "./errorMapper";

/**
 * Unit tests for backend-to-frontend error mapping.
 *
 * These tests verify that backend validation errors
 * are correctly translated into frontend form errors.
 *
 * Test Cases
 * ----------
 * mapRegisterErrors()
 * ✓ should map backend register errors to frontend field names
 * ✓ should return an empty object when no errors exist
 *
 * mapLoginErrors()
 * ✓ should map backend login field errors
 * ✓ should ignore non-field authentication errors
 * ✓ should return an empty object when no field errors exist
 */

describe("errorMapper", () => {
  describe("mapRegisterErrors", () => {
    // Test Case 1
    it("should map backend register errors to frontend field names", () => {
      // Arrange
      const backendErrors = {
        first_name: ["First name is required."],
        last_name: ["Last name is required."],
        email: ["Email already exists."],
        password: ["Password is too weak."],
      };

      // Act
      const result = mapRegisterErrors(backendErrors);

      // Assert
      expect(result).toEqual({
        firstName: "First name is required.",
        lastName: "Last name is required.",
        email: "Email already exists.",
        password: "Password is too weak.",
      });
    });

    // Test Case 2
    it("should return an empty object when no errors exist", () => {
      // Arrange
      const backendErrors = {};

      // Act
      const result = mapRegisterErrors(backendErrors);

      // Assert
      expect(result).toEqual({
        firstName: undefined,
        lastName: undefined,
        email: undefined,
        password: undefined,
      });
    });
  });

  describe("mapLoginErrors", () => {
    // Test Case 3
    it("should map backend login field errors", () => {
      // Arrange
      const backendErrors = {
        email: ["Email is required."],
        password: ["Password is required."],
      };

      // Act
      const result = mapLoginErrors(backendErrors);

      // Assert
      expect(result).toEqual({
        email: "Email is required.",
        password: "Password is required.",
      });
    });

    // Test Case 4
    it("should ignore non-field authentication errors", () => {
      // Arrange
      const backendErrors = {
        detail: "Invalid email or password.",
      };

      // Act
      const result = mapLoginErrors(backendErrors);

      // Assert
      expect(result).toEqual({
        email: undefined,
        password: undefined,
      });
    });

    // Test Case 5
    it("should return an empty object when no field errors exist", () => {
      // Arrange
      const backendErrors = {};

      // Act
      const result = mapLoginErrors(backendErrors);

      // Assert
      expect(result).toEqual({
        email: undefined,
        password: undefined,
      });
    });
  });
});
