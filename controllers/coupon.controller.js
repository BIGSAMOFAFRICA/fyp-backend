export const getCoupon = (req, res) => {
  res.status(200).json({
    code: "BIGSAMOFAFRICA",
    discount: 30, 
  });
};

export const validateCoupon = (req, res) => {
  const { couponCode } = req.body;

  if (couponCode === "BIGSAMOFAFRICA") {
    return res.status(200).json({
      success: true,
      discount: 30,
      message: "Coupon applied successfully",
    });
  }

  return res.status(400).json({
    success: false,
    discount: 0,
    message: "Invalid coupon code",
  });
};
