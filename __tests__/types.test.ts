import { describe, it, expectTypeOf } from "vitest";
import type { ApiResponse, ApiSuccess, ApiError, User } from "@/types";

describe("TypeScript Types", () => {
  it("ApiResponse discriminated union works correctly", () => {
    const success: ApiSuccess<User> = {
      success: true,
      data: {
        id: 1,
        email: "test@test.com",
        name: "Test User",
        createdAt: new Date(),
      },
    };
    const error: ApiError = {
      success: false,
      error: "Not found",
      code: "NOT_FOUND",
    };

    expectTypeOf(success).toMatchTypeOf<ApiResponse<User>>();
    expectTypeOf(error).toMatchTypeOf<ApiResponse<User>>();
  });

  it("User type has required fields", () => {
    expectTypeOf<User>().toHaveProperty("id");
    expectTypeOf<User>().toHaveProperty("email");
    expectTypeOf<User>().toHaveProperty("name");
  });
});
