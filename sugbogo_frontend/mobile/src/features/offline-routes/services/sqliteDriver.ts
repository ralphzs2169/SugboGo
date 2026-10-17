// Native builds use Expo's declared SQLite dependency; web resolves sqliteDriver.web.ts.
export { openDatabaseAsync } from "expo-sqlite";
