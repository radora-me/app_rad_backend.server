const service = require("./tutor.service");

class StudentAiTutorController {
  async context(req, res) {
    try {
      const result = await service.getContext(req.user.id);
      res.json(result);
    } catch (err) {
      const status = err.message === "Student not found" ? 404 : 400;
      res.status(status).json({ error: err.message });
    }
  }

  async chat(req, res) {
    try {
      const result = await service.chat(req.user.id, req.body);
      res.json(result);
    } catch (err) {
      const status = err.message === "Student not found" ? 404 : 500;
      res.status(status).json({ error: err.message });
    }
  }

  async stream(req, res) {
    res.status(200);
    res.set({
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders?.();

    try {
      const result = await service.streamChat(req.user.id, req.body, async (text) => {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ type: "token", text })}\n\n`);
        }
      });

      if (!res.writableEnded) {
        res.write(
          `data: ${JSON.stringify({
            type: "done",
            usedFallback: result.usedFallback,
            cached: result.cached,
          })}\n\n`,
        );
        res.end();
      }
    } catch (err) {
      if (!res.writableEnded) {
        res.write(
          `data: ${JSON.stringify({
            type: "error",
            error: err.message || "Failed to stream AI Tutor response",
          })}\n\n`,
        );
        res.end();
      }
    }
  }
}

module.exports = new StudentAiTutorController();
