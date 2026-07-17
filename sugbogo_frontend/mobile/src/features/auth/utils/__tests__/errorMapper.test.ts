import { mapLoginErrors, mapRegisterErrors } from "../errorMapper";

/**
 * @file errorMapper.test.ts
 * @description Unit tests for backend-to-frontend error mapping.
 *
 * Verifies that backend validation errors are correctly
 * transformed into frontend form error structures,
 * including field mappings and handling missing errors.
 *
 * Run:
 * npm test -- errorMapper.test.ts
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
