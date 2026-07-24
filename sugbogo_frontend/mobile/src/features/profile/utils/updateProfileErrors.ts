import { ApiError } from "@/shared/api/types";
import { UpdateProfileErrors } from "../utils/updateProfileValidator";

export default function getUpdateProfileErrors(
  response: ApiError,
): UpdateProfileErrors {
  return {
    firstName: response.errors?.first_name?.[0],
    lastName: response.errors?.last_name?.[0],
  };
}
