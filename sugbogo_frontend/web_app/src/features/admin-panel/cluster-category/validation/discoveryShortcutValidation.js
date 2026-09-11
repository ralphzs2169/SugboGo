export function validateDiscoveryShortcut(values) {
  const errors = {};
  const title = values.title?.trim() ?? "";
  const subtitle = values.subtitle?.trim() ?? "";

  if (!values.cluster_id) {
    errors.cluster_id = "Please select a cluster.";
  }

  if (!title) {
    errors.title = "Title is required.";
  } else if (title.length > 100) {
    errors.title = "Title must not exceed 100 characters.";
  }

  if (!subtitle) {
    errors.subtitle = "Subtitle is required.";
  } else if (subtitle.length > 200) {
    errors.subtitle = "Subtitle must not exceed 200 characters.";
  }

  return errors;
}
