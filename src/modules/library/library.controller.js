const service = require("./library.service");

class LibraryController {
  async listBooks(req, res) { return this._run(res, () => service.listBooks()); }
  async getBook(req, res) { return this._run(res, () => service.getBook(req.params.id)); }
  async getBookByQR(req, res) { return this._run(res, () => service.getBookByQR(req.params.qrBookId)); }
  async addBook(req, res) { return this._run(res, () => service.addBook(req.user.id, req.body), 201); }
  async regenerateQR(req, res) { return this._run(res, () => service.regenerateQR(req.params.id)); }
  async updateBook(req, res) { return this._run(res, () => service.updateBook(req.params.id, req.body)); }
  async deleteBook(req, res) { return this._run(res, () => service.deleteBook(req.params.id)); }
  async listIssues(req, res) { return this._run(res, () => service.listIssues(req.query)); }
  async issueBook(req, res) { return this._run(res, () => service.issueBook(req.user.id, req.body), 201); }
  async returnBook(req, res) { return this._run(res, () => service.returnBook(req.user.id, req.params.issueId, req.body)); }
  async adminOverview(req, res) { return this._run(res, () => service.adminOverview()); }

  _run(res, action, status = 200) {
    return Promise.resolve().then(action)
      .then((data) => res.status(status).json(data))
      .catch((err) => {
        const notFound = /not found/i.test(err.message || "");
        return res.status(notFound ? 404 : 400).json({ error: err.message || "Library operation failed" });
      });
  }
}

module.exports = new LibraryController();
