const router = require("express").Router();
const auth = require("../../shared/middlewares/auth.middleware");
const role = require("../../shared/middlewares/role.middleware");
const controller = require("./library.controller");

// Admin overview
router.get("/admin/overview", auth, role(["admin"]), (req, res) => controller.adminOverview(req, res));
router.get("/admin/issues", auth, role(["admin"]), (req, res) => controller.listIssues(req, res));

// Librarian + admin — books
router.get("/books", auth, role(["librarian", "admin"]), (req, res) => controller.listBooks(req, res));
router.get("/books/qr/:qrBookId", auth, role(["librarian", "admin"]), (req, res) => controller.getBookByQR(req, res));
router.get("/books/:id", auth, role(["librarian", "admin"]), (req, res) => controller.getBook(req, res));
router.post("/books", auth, role(["librarian", "admin"]), (req, res) => controller.addBook(req, res));
router.post("/books/:id/qr", auth, role(["librarian", "admin"]), (req, res) => controller.regenerateQR(req, res));
router.patch("/books/:id", auth, role(["librarian", "admin"]), (req, res) => controller.updateBook(req, res));
router.delete("/books/:id", auth, role(["librarian", "admin"]), (req, res) => controller.deleteBook(req, res));

// Librarian + admin — issues
router.get("/issues", auth, role(["librarian", "admin"]), (req, res) => controller.listIssues(req, res));
router.post("/issues", auth, role(["librarian", "admin"]), (req, res) => controller.issueBook(req, res));
router.patch("/issues/:issueId/return", auth, role(["librarian", "admin"]), (req, res) => controller.returnBook(req, res));

module.exports = router;
