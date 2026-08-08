import { MERCHANT_REGISTRATION_DEFAULT_VALUES } from "@/features/merchant/constants/registration/defaultValues.constants";
import { isEqual } from "lodash";
import {
  NormalizedIdentity,
  normalizeIdentity,
} from "../normalizers/normalizeIdentity.utils";

const DEFAULT_IDENTITY = normalizeIdentity(
  MERCHANT_REGISTRATION_DEFAULT_VALUES,
);

export function hasIdentityChanged(
  previous: NormalizedIdentity | null,
  current: NormalizedIdentity,
): boolean {
  if (previous === null) {
    return !isEqual(current, DEFAULT_IDENTITY);
  }

  return !isEqual(previous, current);
}
