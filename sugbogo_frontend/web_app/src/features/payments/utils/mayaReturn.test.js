import assert from "node:assert/strict";
import { test } from "node:test";
import { mayaReturnAppUrl } from "./mayaReturn.js";

const destination = "sugbogo://merchant-plus/return";

for (const outcome of ["success", "failure", "cancel"]) {
  test(`Maya bridge forwards only the ${outcome} navigation hint`, () => {
    const search = `?outcome=${outcome}&redirect=https://attacker.invalid&payment_id=private&token=private`;

    assert.equal(mayaReturnAppUrl(search), `${destination}?outcome=${outcome}`);
  });
}

for (const search of [
  "",
  "?outcome=",
  "?outcome=paid",
  "?outcome=SUCCESS",
  "?outcome=success&outcome=cancel",
  "?outcome=success&outcome=success",
  "?outcome=https%3A%2F%2Fattacker.invalid",
  "?outcome=success%26redirect%3Dsugbogo%3A%2F%2Fattacker",
  "?outcome=%3Cscript%3Ealert(1)%3C%2Fscript%3E",
  "?scheme=https&host=attacker.invalid&path=/other",
]) {
  test(`Maya bridge drops malformed or missing hints: ${search}`, () => {
    assert.equal(mayaReturnAppUrl(search), destination);
  });
}
