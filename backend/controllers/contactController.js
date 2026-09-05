import Contact from "../models/Contact.js";

export const createContact = async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "Name, email and message are all required",
      });
    }

    await Contact.create({ name, email, message });

    return res.status(201).json({
      success: true,
      message: "Message sent successfully",
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const firstError = Object.values(error.errors)[0]?.message;
      return res.status(400).json({
        success: false,
        message: firstError || "Invalid input",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Server error, please try again later",
    });
  }
};
