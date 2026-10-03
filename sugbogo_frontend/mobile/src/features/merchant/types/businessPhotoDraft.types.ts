/** A saved photo has an ID; a locally selected photo does not. */
export type BusinessPhotoDraft = {
  id?: number;
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};
