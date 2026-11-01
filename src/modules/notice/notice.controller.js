const service = require("./notice.service");

class NoticeController {
  async list(req, res) {
    try {
      const result = await service.listNotices();
      return res.json(result);
    } catch (err) {
      return this._handleError(res, err);
    }
  }

  async create(req, res) {
    try {
      const { title, content, attachments } = req.body;
      if (!title?.trim()) {
        return res.status(400).json({ message: "Title is required" });
      }
      const result = await service.createNotice(req.user.id, {
        title,
        content,
        attachments,
      });
      return res.status(201).json(result);
    } catch (err) {
      return this._handleError(res, err);
    }
  }

  async delete(req, res) {
    try {
      if (!req.params.noticeId) {
        return res.status(400).json({ message: "Notice ID is required" });
      }
      const result = await service.deleteNotice(req.user.id, req.params.noticeId);
      return res.json(result);
    } catch (err) {
      return this._handleError(res, err);
    }
  }

  async download(req, res) {
    try {
      const { noticeId, fileId } = req.params;
      if (!noticeId || !fileId) {
        return res.status(400).json({ message: "Notice ID and File ID are required" });
      }
      const file = await service.getDownload(noticeId, fileId);
      return res.redirect(file.url);
    } catch (err) {
      return this._handleError(res, err);
    }
  }

  _handleError(res, err) {
    const status =
      err.message === "Notice not found" || err.message === "Attachment not found"
        ? 404
        : 400;
    return res.status(status).json({ error: err.message });
  }
}

module.exports = new NoticeController();
