/** Persistent in-memory adapter for Expo files; real repository tests still execute actual SQLite. */
export const mockFiles = new Map<string, number>();
export const mockDirectories = new Set<string>();
export const mockDownload = jest.fn();
export const mockDelete = jest.fn();

function uri(parts: (string | { uri: string })[]): string {
  return parts
    .map((part) => (typeof part === "string" ? part : part.uri))
    .join("/")
    .replace(/([^:])\/{2,}/g, "$1/")
    .replace(/^file:\/+/, "file:///");
}

export class MockDirectory {
  uri: string;
  constructor(...parts: (string | { uri: string })[]) {
    this.uri = uri(parts);
  }
  create() {
    mockDirectories.add(this.uri);
  }
}

export class MockFile {
  uri: string;
  constructor(...parts: (string | { uri: string })[]) {
    this.uri = uri(parts);
  }
  get exists() {
    return mockFiles.has(this.uri);
  }
  get size() {
    return mockFiles.get(this.uri) ?? 0;
  }
  get parentDirectory() {
    return new MockDirectory(this.uri.slice(0, this.uri.lastIndexOf("/")));
  }
  delete() {
    mockDelete(this.uri);
    mockFiles.delete(this.uri);
  }
  move(destination: MockFile) {
    mockFiles.set(destination.uri, this.size);
    mockFiles.delete(this.uri);
    this.uri = destination.uri;
  }
  static async downloadFileAsync(
    source: string,
    destination: MockFile,
    options: unknown,
  ) {
    await mockDownload(source, destination, options);
    return destination;
  }
}

export function resetCoverFileMock() {
  mockFiles.clear();
  mockDirectories.clear();
  mockDelete.mockReset();
  mockDownload
    .mockReset()
    .mockImplementation(
      async (
        _source: string,
        file: MockFile,
        options: { signal?: AbortSignal },
      ) => {
        if (options.signal?.aborted) throw new Error("Aborted");
        mockFiles.set(file.uri, 1024);
      },
    );
}
