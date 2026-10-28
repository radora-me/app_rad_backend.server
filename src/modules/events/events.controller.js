const service = require("./events.service");

class EventsController {
  async list(req, res) { return this._run(res, () => service.list()); }
  async getOne(req, res) { return this._run(res, () => service.getOne(req.params.id)); }
  async create(req, res) { return this._run(res, () => service.create(req.user.id, req.body), 201); }
  async updateStatus(req, res) { return this._run(res, () => service.updateStatus(req.user.id, req.params.id, req.body.status)); }
  async addMedia(req, res) { return this._run(res, () => service.addMedia(req.user.id, req.params.id, req.body.media), 201); }
  async removeMedia(req, res) { return this._run(res, () => service.removeMedia(req.user.id, req.params.id, req.params.mediaId)); }
  async remove(req, res) { return this._run(res, () => service.remove(req.user.id, req.params.id)); }

  _run(res, action, status = 200) {
    return Promise.resolve()
      .then(action)
      .then((data) => res.status(status).json(data))
      .catch((err) => {
        const notFound = /not found/i.test(err.message || "");
        return res.status(notFound ? 404 : 400).json({ error: err.message || "Event operation failed" });
      });
  }
}

module.exports = new EventsController();
