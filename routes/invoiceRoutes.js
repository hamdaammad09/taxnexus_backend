const router = require("express").Router();
const multer = require("multer");

// Configure storage (better than default)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// Middleware
const auth = require("../middleware/authMiddleware");

// Controllers
const {
  uploadInvoice,
  getInvoiceHistory,
  getInvoiceById,
  sendInvoiceToFBR,
} = require("../controllers/invoiceController");


// 🔹 1. Upload Excel file
router.post("/upload", auth, upload.single("file"), uploadInvoice);


// 🔹 2. Get all invoices (for dashboard/history)
router.get("/history", auth, getInvoiceHistory);


// 🔹 3. Get single invoice details
router.get("/:id", auth, getInvoiceById);


// 🔹 4. Send invoice to FBR (after validation)
router.post("/send/:id", auth, sendInvoiceToFBR);


module.exports = router;