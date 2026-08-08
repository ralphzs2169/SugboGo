export function inferMimeType(fileName?: string | null) {
  if (!fileName) {
    return undefined;
  }

  const extension = fileName.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "pdf":
      return "application/pdf";

    case "jpg":
    case "jpeg":
      return "image/jpeg";

    case "png":
      return "image/png";

    default:
      return undefined;
  }
}
