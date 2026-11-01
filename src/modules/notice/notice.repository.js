const prisma = require("../../core/database/prisma");

class NoticeRepository {
  list() {
    return prisma.notice.findMany({
      include: this.include(),
      orderBy: { createdAt: "desc" },
    });
  }

  findById(noticeId) {
    return prisma.notice.findUnique({
      where: { id: noticeId },
      include: this.include(),
    });
  }

  create(data) {
    return prisma.notice.create({ data, include: this.include() });
  }

  delete(noticeId) {
    return prisma.notice.delete({ where: { id: noticeId } });
  }

  include() {
    return {
      createdBy: { select: { id: true, name: true, email: true } },
      attachments: { include: { file: true } },
    };
  }

  transaction(cb) {
    return prisma.$transaction(cb);
  }
}

module.exports = new NoticeRepository();
