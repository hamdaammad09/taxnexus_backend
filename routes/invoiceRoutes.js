const router = require("express").Router();
const multer = require("multer");
const upload = multer({ dest: "uploads/" });

const auth = require("../middleware/authMiddleware");
const { uploadInvoice } = require("../controllers/invoiceController");

router.post("/upload", auth, upload.single("file"), uploadInvoice);

module.exports = router;