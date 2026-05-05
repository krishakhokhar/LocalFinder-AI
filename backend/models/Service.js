import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema({
  name: String,
  type: String,
  lat: Number,
  lng: Number,
  rating: Number,
});

export default mongoose.model("Service", serviceSchema);