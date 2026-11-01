const QRCode = require("qrcode");
const prisma = require("../../core/database/prisma");

const BOOK_INCLUDE = {
  addedBy: { select: { id: true, name: true } },
  issues: {
    where: { status: "ISSUED" },
    include: { student: { select: { id: true, name: true, rollNumber: true } } },
    take: 5,
  },
};

const ISSUE_INCLUDE = {
  book: { select: { id: true, bookId: true, title: true, author: true } },
  student: { select: { id: true, name: true, rollNumber: true, className: true } },
  issuedBy: { select: { id: true, name: true } },
};

function _genBookId() {
  return `BK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

async function _generateQR(bookId, title) {
  const payload = JSON.stringify({ bookId, title, type: "RADORA_BOOK" });
  return QRCode.toDataURL(payload, { errorCorrectionLevel: "H", width: 300, margin: 2 });
}

// ── Books ─────────────────────────────────────────────────────────────────────
async function listBooks() {
  const books = await prisma.book.findMany({ include: BOOK_INCLUDE, orderBy: { createdAt: "desc" } });
  return books;
}

async function getBook(bookId) {
  const book = await prisma.book.findUnique({ where: { id: bookId }, include: BOOK_INCLUDE });
  if (!book) throw new Error("Book not found");
  return book;
}

async function getBookByQR(qrBookId) {
  const book = await prisma.book.findUnique({ where: { bookId: qrBookId }, include: BOOK_INCLUDE });
  if (!book) throw new Error("Book not found");
  return book;
}

async function addBook(userId, input) {
  if (!input.title?.trim()) throw new Error("Book title is required");
  const bookId = input.bookId?.trim() || _genBookId();
  const existing = await prisma.book.findUnique({ where: { bookId } });
  if (existing) throw new Error("Book ID already exists");

  const copies = Math.max(1, Number(input.totalCopies) || 1);
  const qrCode = await _generateQR(bookId, input.title.trim());

  return prisma.book.create({
    data: {
      bookId,
      title: input.title.trim(),
      author: input.author?.trim() || null,
      publisher: input.publisher?.trim() || null,
      isbn: input.isbn?.trim() || null,
      category: input.category?.trim() || null,
      totalCopies: copies,
      availableCopies: copies,
      qrCode,
      addedById: userId,
    },
    include: BOOK_INCLUDE,
  });
}

async function regenerateQR(bookId) {
  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) throw new Error("Book not found");
  const qrCode = await _generateQR(book.bookId, book.title);
  return prisma.book.update({ where: { id: bookId }, data: { qrCode }, include: BOOK_INCLUDE });
}

async function updateBook(bookId, input) {
  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) throw new Error("Book not found");
  return prisma.book.update({
    where: { id: bookId },
    data: {
      ...(input.title && { title: input.title.trim() }),
      ...(input.author !== undefined && { author: input.author?.trim() || null }),
      ...(input.publisher !== undefined && { publisher: input.publisher?.trim() || null }),
      ...(input.isbn !== undefined && { isbn: input.isbn?.trim() || null }),
      ...(input.category !== undefined && { category: input.category?.trim() || null }),
      ...(input.status && { status: input.status }),
    },
    include: BOOK_INCLUDE,
  });
}

async function deleteBook(bookId) {
  const book = await prisma.book.findUnique({ where: { id: bookId }, include: { issues: { where: { status: "ISSUED" } } } });
  if (!book) throw new Error("Book not found");
  if (book.issues.length) throw new Error("Cannot delete a book that is currently issued");
  await prisma.book.delete({ where: { id: bookId } });
  return { message: "Book deleted" };
}

// ── Issues ────────────────────────────────────────────────────────────────────
async function listIssues(filters = {}) {
  const where = {};
  if (filters.status) where.status = filters.status;
  if (filters.studentId) where.studentId = filters.studentId;
  if (filters.bookId) where.bookId = filters.bookId;
  return prisma.bookIssue.findMany({ where, include: ISSUE_INCLUDE, orderBy: { issuedAt: "desc" }, take: 200 });
}

async function issueBook(librarianId, input) {
  if (!input.qrBookId) throw new Error("Book QR ID is required");
  if (!input.studentRollNumber) throw new Error("Student roll number is required");

  const book = await prisma.book.findUnique({ where: { bookId: input.qrBookId } });
  if (!book) throw new Error("Book not found — scan a valid QR code");
  if (book.availableCopies < 1) throw new Error("No copies available for this book");

  const student = await prisma.user.findFirst({
    where: { rollNumber: String(input.studentRollNumber).trim(), role: "student" },
    select: { id: true, name: true, rollNumber: true },
  });
  if (!student) throw new Error(`Student with roll number ${input.studentRollNumber} not found`);

  const existing = await prisma.bookIssue.findFirst({
    where: { bookId: book.id, studentId: student.id, status: "ISSUED" },
  });
  if (existing) throw new Error("This student already has this book issued");

  const dueDate = input.dueDate ? new Date(input.dueDate) : new Date(Date.now() + 14 * 86400000);

  return prisma.$transaction(async (tx) => {
    const issue = await tx.bookIssue.create({
      data: {
        bookId: book.id,
        studentId: student.id,
        issuedById: librarianId,
        dueDate,
        notes: input.notes?.trim() || null,
      },
      include: ISSUE_INCLUDE,
    });
    await tx.book.update({
      where: { id: book.id },
      data: {
        availableCopies: book.availableCopies - 1,
        status: book.availableCopies - 1 === 0 ? "ISSUED" : "AVAILABLE",
      },
    });
    return issue;
  });
}

async function returnBook(librarianId, issueId, input = {}) {
  const issue = await prisma.bookIssue.findUnique({ where: { id: issueId }, include: { book: true } });
  if (!issue) throw new Error("Issue record not found");
  if (issue.status !== "ISSUED") throw new Error("This book is not currently issued");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.bookIssue.update({
      where: { id: issueId },
      data: {
        status: input.status || "RETURNED",
        returnedAt: new Date(),
        notes: input.notes?.trim() || issue.notes,
      },
      include: ISSUE_INCLUDE,
    });
    const book = issue.book;
    await tx.book.update({
      where: { id: book.id },
      data: {
        availableCopies: Math.min(book.totalCopies, book.availableCopies + 1),
        status: "AVAILABLE",
      },
    });
    return updated;
  });
}

// ── Student — my issued books ─────────────────────────────────────────────────
async function studentMyIssues(userId) {
  const student = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!student) throw new Error("Student not found");

  const issues = await prisma.bookIssue.findMany({
    where: { studentId: userId },
    include: ISSUE_INCLUDE,
    orderBy: { issuedAt: "desc" },
    take: 100,
  });

  const currentlyIssued = issues.filter((i) => i.status === "ISSUED").length;
  const overdueCount = issues.filter((i) => i.status === "ISSUED" && new Date(i.dueDate) < new Date()).length;
  const totalReturned = issues.filter((i) => i.status === "RETURNED").length;

  return { currentlyIssued, overdueCount, totalReturned, issues };
}

// ── Admin / Librarian overview ────────────────────────────────────────────────
async function adminOverview() {
  const [totalBooks, totalIssued, overdueCount, recentIssues] = await Promise.all([
    prisma.book.count(),
    prisma.bookIssue.count({ where: { status: "ISSUED" } }),
    prisma.bookIssue.count({ where: { status: "ISSUED", dueDate: { lt: new Date() } } }),
    prisma.bookIssue.findMany({ orderBy: { issuedAt: "desc" }, take: 20, include: ISSUE_INCLUDE }),
  ]);
  return { totalBooks, totalIssued, overdueCount, recentIssues };
}

module.exports = { listBooks, getBook, getBookByQR, addBook, regenerateQR, updateBook, deleteBook, listIssues, issueBook, returnBook, adminOverview, studentMyIssues };
