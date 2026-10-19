if (!process.env.DEV_DATABASE_URL) {
  throw new Error("DEV_DATABASE_URL must be set to run the development server.");
}

process.env.DATABASE_URL = process.env.DEV_DATABASE_URL;
process.env.NODE_ENV = "development";

console.log("Starting development server with DEV_DATABASE_URL.");
await import("./server/index.ts");
