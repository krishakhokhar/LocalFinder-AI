import "../config/loadEnv.js"; // must stay the first import - see the file

import mongoose from "mongoose";
import connectDB from "../config/db.js";
import { assertEnv } from "../config/env.js";
import Category from "../models/Category.js";
import { BUILT_IN_CATEGORIES } from "../config/categories.js";
import { VALID_CATEGORIES } from "../utils/overpass.js";

assertEnv();
await connectDB();

// Upsert: re-running never duplicates, and never clobbers an admin's edits
// to label/description beyond the fields seeded here.
let inserted = 0;
for (const category of BUILT_IN_CATEGORIES) {
  const result = await Category.updateOne(
    { key: category.key },
    {
      $setOnInsert: {
        key: category.key,
        label: category.label,
        icon: category.icon,
        description: category.description,
        order: category.order,
        active: true,
        supportsExternalSearch: VALID_CATEGORIES.includes(category.key),
      },
    },
    { upsert: true }
  );
  if (result.upsertedCount) inserted += 1;
}

console.log(`Categories seeded. ${inserted} new, ${BUILT_IN_CATEGORIES.length - inserted} already present.`);
await mongoose.connection.close();
process.exit(0);
