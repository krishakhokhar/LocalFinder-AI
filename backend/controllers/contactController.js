import Contact from "../models/Contact.js";
import { created } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const createContact = asyncHandler(async (req, res) => {
  const { name, email, subject, message } = req.body;

  await Contact.create({
    name,
    email,
    subject,
    message,
    // Attached when the sender happens to be signed in, so support can see
    // the account behind a message without asking for it.
    user: req.user?._id || null,
  });

  return created(res, { message: "Message sent successfully" });
});
