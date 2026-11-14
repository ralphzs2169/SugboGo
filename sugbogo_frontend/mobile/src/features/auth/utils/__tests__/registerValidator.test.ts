import { validateRegisterForm } from "../registerValidator";

describe("registration form validation", () => {
  it("requires the name and email before sending verification", () => {
    expect(validateRegisterForm("", "", "")).toEqual({
      firstName: "First name is required.",
      lastName: "Last name is required.",
      email: "Email is required.",
    });
  });

  it("rejects an invalid email address", () => {
    expect(validateRegisterForm("John", "Doe", "john")).toEqual({
      email: "Enter a valid email address.",
    });
  });

  it("accepts signup details without a password", () => {
    expect(validateRegisterForm("John", "Doe", "john@example.com")).toEqual({});
  });
});
