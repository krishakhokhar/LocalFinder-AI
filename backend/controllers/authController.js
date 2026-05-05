export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 🔍 USER CHECK
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found ❌",
      });
    }

    // 🔐 PASSWORD CHECK
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Wrong password ❌",
      });
    }

    // 🔑 TOKEN
    const token = jwt.sign({ id: user._id }, "secret123");

    // ✅ SUCCESS ONLY HERE
    res.status(200).json({
      success: true,
      message: "Login successful ✅",
      token,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error ❌",
    });
  }
};