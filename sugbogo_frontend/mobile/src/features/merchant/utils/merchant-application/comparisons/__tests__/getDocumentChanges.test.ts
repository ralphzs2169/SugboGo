import { getDocumentChanges } from "../getDocumentChanges.utils";

const savedDocument = (id: number) => ({
  id,
  uri: `https://example.test/${id}.pdf`,
  fileName: `${id}.pdf`,
  mimeType: "application/pdf",
});

describe("getDocumentChanges", () => {
  it("sends the replaced primary-document ID for deletion", () => {
    const changes = getDocumentChanges(
      {
        businessRegistration: savedDocument(10),
        authorizationDocument: savedDocument(20),
        additionalDocuments: [],
      },
      {
        businessRegistration: {
          uri: "file:///replacement.pdf",
          fileName: "replacement.pdf",
          mimeType: "application/pdf",
        },
        authorizationDocument: null,
        additionalDocuments: [],
      },
    );

    expect(changes).toEqual({
      hasChanges: true,
      deletedDocumentIds: [10, 20],
    });
  });
});
