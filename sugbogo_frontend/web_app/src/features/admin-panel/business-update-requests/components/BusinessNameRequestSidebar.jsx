import UpdateRequestSidebar from "./UpdateRequestSidebar";

const NAME_REVIEW_CHECKLIST = [
  "Does the requested name appropriately represent the business?",
  "Does the name align with the business's existing information?",
  "Could the name be misleading or confused with another business?",
  "Does the merchant's explanation reasonably support the change?",
];

/** Supplies name-specific guidance to the shared request sidebar. */
export default function BusinessNameRequestSidebar({ request }) {
  return (
    <UpdateRequestSidebar
      request={request}
      checklistQuestions={NAME_REVIEW_CHECKLIST}
    />
  );
}
